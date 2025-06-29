#!/bin/bash
# /usr/local/bin/start.sh
set -e

# Ensure docker-compose is executable
sudo chmod +x /usr/local/bin/docker-compose

# Check if ec2-user is already in the docker group; if not, add it.
if ! id -nG ec2-user | grep -qw docker; then
    sudo usermod -aG docker ec2-user
fi

docker compose build -d
sleep 5
docker compose up -d
sleep 5
docker compose exec -T web bash -c "npm run start"
sleep 5
