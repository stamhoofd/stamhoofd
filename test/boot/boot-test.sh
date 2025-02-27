#!/bin/bash

# Go to the backend API folder (note that it should be built already)
cd backend/app/api;

# Start the process in the background
node dist/index.js &
PID=$!  # Capture the PID of the background process

# Wait a few seconds
sleep 5

# Send SIGTERM to the process
echo "Sending SIGTERM to the process with PID $PID..."
kill -SIGTERM $PID

# Wait for the process to exit
echo "Waiting for the API to exit..."
wait $PID
EXIT_CODE=$?

# Check the exit code
if [ $EXIT_CODE -eq 0 ]; then
    echo "Process exited successfully with code 0."
else
    echo "Process exited with code $EXIT_CODE."
fi

exit $EXIT_CODE
