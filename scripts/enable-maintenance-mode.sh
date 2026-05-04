#!/bin/bash

source "$(dirname "$0")/load-env.sh"

docker compose exec nginx-public touch /usr/share/nginx/html/maintenance.json