#!/bin/bash

# Script to install new packages in Docker development environment
# Usage: ./install-package.sh <service-name> <package-name>
# Example: ./install-package.sh backend express

if [ $# -lt 2 ]; then
    echo "Usage: $0 <service-name> <package-name> [--save-dev]"
    echo "Example: $0 backend express"
    echo "Example: $0 frontend @types/react --save-dev"
    exit 1
fi

SERVICE=$1
PACKAGE=$2
SAVE_FLAG=${3:-""}

echo "Installing $PACKAGE in $SERVICE service..."

# Install the package in the running container
if [ "$SAVE_FLAG" = "--save-dev" ]; then
    docker-compose exec $SERVICE npm install $PACKAGE --save-dev
else
    docker-compose exec $SERVICE npm install $PACKAGE
fi

# Rebuild the service to persist the change
echo "Rebuilding $SERVICE service..."
docker-compose build $SERVICE

echo "Package $PACKAGE installed successfully in $SERVICE!"
