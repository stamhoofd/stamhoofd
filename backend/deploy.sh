#!/bin/bash
set -e

rsync -a -e "ssh -T -p 22 -o Compression=no -x" --delete --info=progress2 --filter=":- .gitignore" --exclude ".git" --no-owner --no-group --no-perms -W ./ root@api.stamhoofd.app:/etc/stamhoofd

ssh root@api.stamhoofd.app 'bash' <<'ENDSSH'
    set -e

    # Load scripts
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
    [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion
    export PATH="$(yarn global bin):$PATH"

    cd /etc/stamhoofd
    rm -rf node_modules

    # Do not build tests
    rm src/**/*.test.ts

    yarn install --production
    yarn build
    yarn migrations
    #pm2 start dist/index.js --time --name stamhoofd
    pm2 restart stamhoofd
ENDSSH