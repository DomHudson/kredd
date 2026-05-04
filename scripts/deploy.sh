#!/bin/bash

set -e

SCRIPT_DIR="$(dirname "$0")"

source "$SCRIPT_DIR/load-env.sh"

git pull

echo "Enabling maintenance mode..."
"$SCRIPT_DIR/enable-maintenance-mode.sh"

echo "Waiting 40 seconds for in-flight requests to drain..."
sleep 40

NON_NGINX=$(docker compose config --services | grep -v nginx-public | tr '\n' ' ')

docker compose stop $NON_NGINX

docker compose build $NON_NGINX

docker compose up -d --no-deps $NON_NGINX

echo "Disabling maintenance mode..."
"$SCRIPT_DIR/disable-maintenance-mode.sh"

echo "Deploy complete."
