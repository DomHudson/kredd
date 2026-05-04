#!/bin/bash

source "$(dirname "$0")/load-env.sh"

exec docker run --rm -it -v "$PWD/frontend:/app" -w /app node:22-alpine sh
