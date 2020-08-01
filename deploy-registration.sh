#!/bin/bash
set -e

cd app/registration
yarn build:production
cd ../..
rsync -a -e "ssh -T -p 22 -o Compression=no -x" --delete --delay-updates --delete-delay --info=progress2 --no-owner --no-group --no-perms -W ./app/registration/dist/ root@stamhoofd.app:/etc/stamhoofd/registration
