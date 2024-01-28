# This will load the .env file if it exists
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi