#!/bin/sh
set -e

if [ -n "$KREDD_CERTBOT_DOMAIN" ]; then
    if [ ! -f "/etc/letsencrypt/live/$KREDD_CERTBOT_DOMAIN/fullchain.pem" ]; then
        echo "Generating certificate for $KREDD_CERTBOT_DOMAIN..."
        certbot certonly \
            --standalone \
            --non-interactive \
            --agree-tos \
            --email "$KREDD_CERTBOT_EMAIL" \
            -d "$KREDD_CERTBOT_DOMAIN"
    else
        echo "Renewing certificate for $KREDD_CERTBOT_DOMAIN..."
        certbot renew --standalone --non-interactive --quiet
    fi

    envsubst '${KREDD_CERTBOT_DOMAIN}' < /etc/nginx/nginx-ssl.public.conf > /etc/nginx/conf.d/default.conf
else
    echo "Running without SSL..."
fi

exec nginx -g 'daemon off;'
