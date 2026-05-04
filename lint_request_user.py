"""
Flags direct request.user attribute access.

Views should use request.get_effective_user() so that staff impersonation is
honoured automatically.  The two legitimate exceptions are auth checks:

    request.user.is_authenticated
    request.user.is_staff
    request.user.is_active

Suppress false positives inline with:  # noqa: RU001

Usage:
    python lint_request_user.py [paths...]   # default: app/
"""

import ast
import sys
from pathlib import Path

# Attribute chains on request.user that are fine (auth guards, not data access).
_ALLOWED_CHAINS = {"is_authenticated", "is_staff", "is_active"}

RULE = "RU001"
MESSAGE = "Direct request.user access; use request.get_effective_user() instead"


def _is_request_user(node: ast.AST) -> bool:
    """True if node is the expression `request.user`."""
    return (
        isinstance(node, ast.Attribute)
        and node.attr == "user"
        and isinstance(node.value, ast.Name)
        and node.value.id == "request"
    )


def check_file(path: Path) -> list[tuple[int, int, str]]:
    source = path.read_text()
    lines = source.splitlines()
    tree = ast.parse(source, filename=str(path))
    violations = []

    for node in ast.walk(tree):
        if not _is_request_user(node):
            continue

        # Allow: request.user.is_authenticated / .is_staff / .is_active
        parent_attr = getattr(node, "_parent_attr", None)
        if parent_attr in _ALLOWED_CHAINS:
            continue

        lineno = node.lineno
        col = node.col_offset

        # Respect inline noqa comment.
        line_text = lines[lineno - 1] if lineno <= len(lines) else ""
        if "noqa: RU001" in line_text or "noqa" in line_text.split("#")[-1]:
            continue

        violations.append((lineno, col, f"{path}:{lineno}:{col}: {RULE} {MESSAGE}"))

    return violations


def _annotate_parents(tree: ast.AST) -> None:
    """Tag each Attribute node with the attribute name its parent reads from it."""
    for node in ast.walk(tree):
        if isinstance(node, ast.Attribute) and _is_request_user(node.value):
            node.value._parent_attr = node.attr  # type: ignore[attr-defined]


def check_file_with_parents(path: Path) -> list[tuple[int, int, str]]:
    source = path.read_text()
    lines = source.splitlines()
    try:
        tree = ast.parse(source, filename=str(path))
    except SyntaxError:
        return []

    _annotate_parents(tree)

    violations = []
    for node in ast.walk(tree):
        if not _is_request_user(node):
            continue

        parent_attr = getattr(node, "_parent_attr", None)
        if parent_attr in _ALLOWED_CHAINS:
            continue

        lineno = node.lineno
        col = node.col_offset
        line_text = lines[lineno - 1] if lineno <= len(lines) else ""
        if "noqa" in line_text.split("#")[-1]:
            continue

        violations.append((lineno, col, f"{path}:{lineno}:{col}: {RULE} {MESSAGE}"))

    return violations


def main() -> int:
    roots = [Path(p) for p in sys.argv[1:]] or [Path("app")]
    files = []
    for root in roots:
        if root.is_file():
            files.append(root)
        else:
            files.extend(root.rglob("*.py"))

    all_violations = []
    for f in sorted(files):
        all_violations.extend(check_file_with_parents(f))

    for _, _, msg in all_violations:
        print(msg)

    return 1 if all_violations else 0


if __name__ == "__main__":
    sys.exit(main())
