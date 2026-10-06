#!/bin/sh
# Runs from nginx's /docker-entrypoint.d before nginx starts; compose passes the host port.
echo "Dragons of Mugloar is running on http://localhost:${WEB_PORT:-8080}"
