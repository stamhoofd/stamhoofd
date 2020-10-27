#!/bin/bash
set -e

#rsync -a -e "ssh -T -p 22 -o Compression=no -x" --delete --info=progress2 --filter=":- .gitignore" --exclude ".git" --no-owner --no-group --no-perms -W ./ root@api.stamhoofd.app:/etc/stamhoofd
cd ../shared/structures
yarn build
cd ../crypto
yarn build
cd ../utility
yarn build
cd ../../backend
yarn build
rsync -a -e "ssh -T -p 22 -o Compression=no -o StrictHostKeyChecking=accept-new -x" --delete --info=progress2 --filter="+ ./dist" --filter="+ ../shared/*/dist" --filter="+ ../shared/*/esm/dist" --filter=":- ../.gitignore" --exclude "../.git" --exclude "../frontend/" --no-owner --no-group --no-perms -W ../ root@api.stamhoofd.app:/etc/stamhoofd

ssh root@api.stamhoofd.app 'bash' <<'ENDSSH'
    set -e

    # Load scripts
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
    [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion
    export PATH="$(yarn global bin):$PATH"

    cd /etc/stamhoofd

    # Do not build tests
    rm backend/src/**/*.test.ts
    rm shared/*/src/**.test.ts

    yarn install --production

    cd /etc/stamhoofd/backend
    node ./dist/migrations.js

    pm2 stop all && pm2 delete all
    pm2 start dist/index.js --time --name stamhoofd
    pm2 save

    #pm2 start dist/index.js --time --name stamhoofd
    #pm2 restart stamhoofd
ENDSSH