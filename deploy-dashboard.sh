#!/bin/bash
set -e

cd app/dashboard
yarn build:production
cd ../..
rsync -a -e "ssh -T -p 22 -o Compression=no -x" --delay-updates --info=progress2 --no-owner --no-group --no-perms -W ./app/dashboard/dist/ root@stamhoofd.app:/etc/stamhoofd/dashboard
