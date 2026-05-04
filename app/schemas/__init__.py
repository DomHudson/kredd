import json
import pathlib


_SCHEMAS_DIR = pathlib.Path(__file__).parent


def load_schema(name: str) -> dict:
    with (_SCHEMAS_DIR / name).open() as f:
        return json.load(f)
