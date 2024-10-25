import { registerCron } from '@stamhoofd/crons';
import { backup, backupBinlogs } from './helpers/backup';

async function createBackups() {
    console.log('Creating backups...');
    await backup();
}

async function backupBinLogs() {
    console.log('Backing up binlogs...');
    await backupBinlogs();
}

registerCron('createBackups', createBackups);
registerCron('backupBinLogs', backupBinLogs);
