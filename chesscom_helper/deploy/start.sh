#!/bin/bash

sudo caddy run --config /etc/caddy/Caddyfile
docker compose up -d
sleep 5
docker compose exec -T web bash -c "npm run dev"
