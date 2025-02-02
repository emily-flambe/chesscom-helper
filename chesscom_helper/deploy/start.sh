#!/bin/bash

docker compose up -d
sleep 5
docker compose exec -T web bash -c "npm run dev"
