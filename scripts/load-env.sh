#!/bin/bash
# Usage: source scripts/load-env.sh  OR  . scripts/load-env.sh
# NOT bash scripts/load-env.sh
set -a
source "$(dirname "${BASH_SOURCE[0]}")/../.env"
set +a
