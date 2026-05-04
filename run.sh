#!/usr/bin/env bash

exec gunicorn kreddapp.wsgi:application --bind 0.0.0.0:8000
