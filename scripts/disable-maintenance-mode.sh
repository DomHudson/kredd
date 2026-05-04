#!/bin/bash

source "$(dirname "$0")/load-env.sh"

docker compose exec nginx-public rm /usr/share/nginx/html/maintenance.json