import { registerCron } from '@stamhoofd/crons';
import { backup, backupBinlogs } from './helpers/backup';
import { Formatter } from '@stamhoofd/utility';

let lastFullBackup: Date | null = null;
const backupStartTime = '02:00';
const backupEndTime = '05:00';

async function createBackups() {
    const now = new Date();

    if (lastFullBackup && Formatter.date(now, true) === Formatter.date(lastFullBackup, true)) {
        return;
    }

    // Check time
    if (Formatter.timeIso(now) < backupStartTime || Formatter.timeIso(now) > backupEndTime) {
        return;
    }

    console.log('Creating full backup...');
    await backup();

    console.log('Full backup created');
    lastFullBackup = now;
}

async function backupBinLogs() {
    console.log('Backing up binlogs...');
    await backupBinlogs();
}

registerCron('createBackups', createBackups);
registerCron('backupBinLogs', backupBinLogs);
