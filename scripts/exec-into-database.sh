#!/bin/bash

source "$(dirname "$0")/load-env.sh"

exec docker compose exec  db   mysql -u "$KREDD_DB_USER" -p"$KREDD_DB_PASSWORD" "$KREDD_DB_NAME"
