import { registerCron } from '@stamhoofd/crons';
import {
    backup,
    backupBinlogs,
    cleanBackups,
    cleanBinaryLogBackups,
    fullBackup,
} from './helpers/backup.js';
import { defineWorker } from '@node/observability/workloads';
import { Formatter } from '@stamhoofd/utility';

let lastFullBackup: Date | null = null;
const binlogs = defineWorker('backup_binlogs');
const cleanup = defineWorker('backup_clean');
const backupStartTime = '02:00';
const backupEndTime = '05:00';

async function createBackups() {
    const now = new Date();

    if (lastFullBackup && Formatter.date(now, true) === Formatter.date(lastFullBackup, true)) {
        fullBackup.skip();
        return;
    }

    // Check time
    if (Formatter.timeIso(now) < backupStartTime || Formatter.timeIso(now) > backupEndTime) {
        fullBackup.skip();
        return;
    }

    console.log('Creating full backup...');
    await backup();

    console.log('Full backup created');
    lastFullBackup = now;
}

async function backupBinLogs() {
    console.log('Backing up binlogs...');
    await binlogs.run(backupBinlogs);
}

let lastClean = new Date(0); // on boot
const cleanInterval = 1000 * 60 * 60 * 4; // every 4 hours

async function clean() {
    const now = new Date();

    if (now.getTime() - lastClean.getTime() > cleanInterval) {
        console.log('Cleaning backups...');
        await cleanup.run(async () => {
            await cleanBackups();
            await cleanBinaryLogBackups();
        });
        lastClean = now;
    } else {
        cleanup.skip();
    }
}

registerCron('createBackups', createBackups);
registerCron('backupBinLogs', backupBinLogs);

registerCron('clean', clean);
