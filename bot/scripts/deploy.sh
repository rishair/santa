#!/bin/bash

# SSH connection details
SERVER="root@161.35.113.147"
SCREEN_NAME="santa-twitter-bot"
REPO_PATH="/root/santa/bot"

# SSH into server and execute commands
ssh $SERVER << EOF
    # Navigate to repository
    cd ${REPO_PATH}

    # Pull latest changes
    git pull origin main

    # Install dependencies
    npm install

    # Kill existing screen session if it exists
    screen -X -S ${SCREEN_NAME} quit > /dev/null 2>&1

    # Create new screen session and start bot
    screen -dmS ${SCREEN_NAME} bash -c "cd ${REPO_PATH} && npm run build && npm run start:bot"

    # Confirm screen session is running
    echo "Bot deployed in new screen session"
    screen -ls
EOF