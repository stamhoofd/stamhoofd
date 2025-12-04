import { DeleteObjectCommand, HeadObjectCommand, ListObjectsCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'; // ES Modules import
import { Database } from '@simonbackx/simple-database';
import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { QueueHandler } from '@stamhoofd/queues';
import { Formatter } from '@stamhoofd/utility';
import chalk from 'chalk';
import { exec } from 'child_process';
import fs from 'fs';
import { DateTime } from 'luxon';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import path from 'path';
import util from 'util';
const execPromise = util.promisify(exec);

// Normally we'll have ±24 binary logs per day (if max size is set to 50MB)
// Since well create a backup every day, keeping 1000 binary logs would give
// a full history of 40 days - and leaves us enough margin in case more
// logs are created in a day
const MAX_BINARY_LOGS = 200;
const MAX_BACKUPS = 30; // in days
const BACKUP_PREFIX = 'backup-';
const BINARY_LOG_PREFIX = 'binlog.';

/**
 * For the health endpoint
 */

let LAST_BINARY_BACKUP: { date: Date } | null = null;

let LAST_BACKUP: { date: Date; size: number } | null = null;

export class BackupDateSize extends AutoEncoder {
    @field({ decoder: StringDecoder })
    date: string;

    @field({ decoder: StringDecoder, optional: true })
    size?: string;
}

async function hashFile(path: string, algo = 'md5') {
    const hashFunc = createHash(algo); // you can also sha256, sha512 etc

    const contentStream = createReadStream(path);
    const updateDone = new Promise<void>((resolve, reject) => {
        contentStream.on('data', data => hashFunc.update(data));
        contentStream.on('close', resolve);
        contentStream.on('error', reject);
    });

    await updateDone;
    return hashFunc.digest('base64'); // will return hash, formatted to HEX
}

export class BackupHealth extends AutoEncoder {
    @field({ decoder: BackupDateSize, nullable: true })
    lastBackup: BackupDateSize | null;

    @field({ decoder: BackupDateSize, nullable: true })
    lastBinaryBackup: BackupDateSize | null;

    @field({ decoder: StringDecoder })
    status: 'ok' | 'error';
}

export function getHealth(): BackupHealth {
    const now = new Date();

    let status: 'ok' | 'error' = 'ok';

    if (!LAST_BINARY_BACKUP || !LAST_BACKUP) {
        status = 'error';
    }
    else {
        if (LAST_BINARY_BACKUP.date.getTime() - now.getTime() > 60 * 10 * 1000) {
            status = 'error';
        }
        if (LAST_BACKUP.date.getTime() - now.getTime() > 60 * 60 * 1000 * 25) {
            status = 'error';
        }
        if (LAST_BACKUP.size < (STAMHOOFD.MINIMUM_BACKUP_SIZE ?? 1 * 1000 * 1000)) {
            status = 'error';
        }
    }

    return BackupHealth.create({
        lastBinaryBackup: LAST_BINARY_BACKUP
            ? BackupDateSize.create({
                    date: Formatter.dateTimeIso(LAST_BINARY_BACKUP.date),
                })
            : null,
        lastBackup: LAST_BACKUP
            ? BackupDateSize.create({
                    date: Formatter.dateTimeIso(LAST_BACKUP.date),
                    size: Formatter.fileSize(LAST_BACKUP.size),
                })
            : null,
        status,
    });
}

export async function cleanBackups() {
    console.log('Cleaning backups...');

    const client = getS3Client();

    // List all backup files on the server
    const allBackups = await listAllFiles(STAMHOOFD.objectStoragePath);

    // Delete backups older than MAX_BACKUPS days (not using count because we want to keep the last 30 days)
    const now = new Date();
    const boundaryDateTime = new Date(now.getTime() - 1000 * 60 * 60 * 24 * MAX_BACKUPS);
    const boundaryFileName = getBackupBaseFileName(boundaryDateTime) + '.gz.enc';
    let lastBackup: ObjectStorageFile | null = null;

    for (const file of allBackups) {
        const filename = path.basename(file.key);
        if (filename.startsWith(BACKUP_PREFIX) && filename.endsWith('.gz.enc')) {
            if (filename < boundaryFileName) {
                console.log('Deleting old backup ' + filename);

                await client.send(new DeleteObjectCommand({
                    Bucket: STAMHOOFD.SPACES_BUCKET,
                    Key: file.key,
                }));
            }
            else {
                if (!lastBackup || lastBackup.key < file.key) {
                    lastBackup = file;
                }
            }
        }
    }

    if (!LAST_BACKUP && lastBackup) {
        // Read timestamp from last backup file
        console.log('Setting last backup timestamp from last backup ' + lastBackup.key);
        LAST_BACKUP = {
            date: getBackupFileDate(path.basename(lastBackup.key)),
            size: lastBackup.size,
        };
    }
}

export async function cleanBinaryLogBackups() {
    console.log('Cleaning binary log backups...');

    const client = getS3Client();

    // List all backup files on the server
    const allBackups = (await listAllFiles(STAMHOOFD.objectStoragePath + '/binlogs')).filter(f => f.key.endsWith('.enc') && path.basename(f.key).startsWith(BINARY_LOG_PREFIX));
    const numberToDelete = allBackups.length - MAX_BINARY_LOGS;

    if (numberToDelete <= 0) {
        console.log('No binary logs to delete');
        return;
    }

    console.log('Found ' + allBackups.length + ' binary logs, deleting ' + numberToDelete);

    for (let i = 0; i < numberToDelete; i++) {
        const file = allBackups[i];
        console.log('Deleting old binary log ' + file.key);

        await client.send(new DeleteObjectCommand({
            Bucket: STAMHOOFD.SPACES_BUCKET,
            Key: file.key,
        }));
    }
}

type ObjectStorageFile = { key: string; lastModified: Date; size: number };

export async function listAllFiles(prefix: string): Promise<ObjectStorageFile[]> {
    const client = getS3Client();
    const files: ObjectStorageFile[] = [];
    let marker: string | undefined;

    // List all backup files on the server
    while (true) {
        const response = await client.send(new ListObjectsCommand({
            Bucket: STAMHOOFD.SPACES_BUCKET,
            Prefix: prefix + '/', // / suffix is required to make Delimiter work
            MaxKeys: 1000,
            Marker: marker,
            Delimiter: '/', // this makes sure we don't go into folders
        }));

        if (response.Contents === undefined) {
            break;
        }

        for (const object of response.Contents) {
            if (files.find(f => f.key === object.Key)) {
                throw new Error('Duplicate key found: ' + object.Key);
            }

            files.push({
                key: object.Key!,
                lastModified: object.LastModified!,
                size: object.Size!,
            });
        }

        if (!response.NextMarker) {
            break;
        }

        marker = response.NextMarker;
    }

    // Sort files: use the name
    files.sort((a, b) => {
        return a.key.localeCompare(b.key);
    });

    return files;
}

export function escapeShellArg(arg) {
    return `'${arg.replace(/'/g, `'\\''`)}'`;
}

export async function diskSpace(): Promise<number> {
    if (process.env.NODE_ENV === 'development') {
        // Not working in MacOS
        return 1000000000000;
    }

    const result = await execPromise('df --output=avail --block-size=1 /');
    const parts = result.stdout.trim().split('\n');
    if (parts.length !== 2 || parts[0].trim() !== 'Avail') {
        throw new Error('Unexected result for df cmd:' + result.stdout);
    }
    const size = parseInt(parts[1].trim());
    return size;
}

export function getS3Client() {
    return new S3Client({
        endpoint: 'https://' + STAMHOOFD.SPACES_ENDPOINT,
        region: STAMHOOFD.AWS_REGION,
        credentials: {
            accessKeyId: STAMHOOFD.SPACES_KEY,
            secretAccessKey: STAMHOOFD.SPACES_SECRET,
        },
    });
}

export function getBackupBaseFileName(date: Date) {
    const timestamp = Formatter.dateIso(date) + '-' + Formatter.timeIso(date).replace(':', 'h');
    const tmpFile = `${BACKUP_PREFIX}${timestamp}.sql`;
    return tmpFile;
}

export function getBackupFileDate(filename: string) {
    if (!filename.startsWith(BACKUP_PREFIX) || !filename.endsWith('.sql.gz.enc')) {
        throw new Error('Invalid backup filename: ' + filename);
    }

    const dateString = filename.substring(BACKUP_PREFIX.length, filename.length - '.sql.gz.enc'.length);

    const year = parseInt(dateString.substring(0, 4));
    const month = parseInt(dateString.substring(5, 7));
    const day = parseInt(dateString.substring(8, 10));

    const hour = parseInt(dateString.substring(11, 13));
    const minute = parseInt(dateString.substring(14, 16));

    console.log('Found date ', {
        year,
        month,
        day,
        hour,
        minute,
    }, 'from', dateString);

    // Convert Brussels timeezone string to date object
    const date = DateTime.fromObject({
        year,
        month,
        day,
        hour,
        minute,
    }, { zone: 'Europe/Brussels' }).toJSDate();

    // Check match
    const expected = getBackupBaseFileName(date) + '.gz.enc';
    if (expected !== filename) {
        throw new Error('Invalid backup filename: ' + filename + ' - expected ' + expected);
    }

    return date;
}

export async function backup() {
    if (QueueHandler.isRunning('backup')) {
        console.log('Backup already running');
        return;
    }
    await QueueHandler.schedule('backup', async () => {
        // Create a backup of the local server and stores it in a .sql.gz file
        const localBackupFolder = STAMHOOFD.localBackupFolder;

        if (!localBackupFolder.endsWith('/')) {
            throw new Error('Backup folder should end with a /');
        }

        if (!STAMHOOFD.DB_DATABASE) {
            throw new Error('DB_DATABASE not set');
        }

        if (!STAMHOOFD.DB_USER) {
            throw new Error('DB_USER not set');
        }

        if (!STAMHOOFD.DB_PASS) {
            throw new Error('DB_PASS not set');
        }

        if (!STAMHOOFD.keyFingerprint) {
            throw new Error('keyFingerprint not set');
        }

        const objectStoragePath = STAMHOOFD.objectStoragePath;

        if (!objectStoragePath) {
            throw new Error('No object storage path defined');
        }

        if (objectStoragePath.endsWith('/')) {
            throw new Error('Object storage path should not end with a /');
        }

        if (objectStoragePath.startsWith('/')) {
            throw new Error('Object storage path should not start with a /');
        }

        if (!STAMHOOFD.SPACES_ENDPOINT) {
            throw new Error('No SPACES_ENDPOINT defined');
        }

        if (!STAMHOOFD.SPACES_BUCKET) {
            throw new Error('No SPACES_BUCKET defined');
        }

        if (!STAMHOOFD.SPACES_KEY) {
            throw new Error('No SPACES_KEY defined');
        }

        if (!STAMHOOFD.SPACES_SECRET) {
            throw new Error('No SPACES_SECRET defined');
        }

        // Delete backups folder
        console.log('Deleting old backups...');
        await execPromise('rm -rf ' + escapeShellArg(localBackupFolder));
        console.log('Deleted old backups');

        // Assert disk space
        const availableDiskSpace = (await diskSpace()) / 1000 / 1000 / 1000;
        const required = Math.max(10, LAST_BACKUP ? Math.ceil(LAST_BACKUP?.size * 15 / 1000 / 1000 / 1000) : 0); // Minimum disk size = 15 times size of a backup (uncompressed size of backup is a lot more than compressed size)
        if (availableDiskSpace < required) {
            throw new Error(`Less than ${required.toFixed(2)}GB disk space available. Avoid creating backups now until this has been resolved.`);
        }

        // Recreate folder
        await execPromise('mkdir -p ' + escapeShellArg(localBackupFolder));

        const tmpFile = `${localBackupFolder}${getBackupBaseFileName(new Date())}`;
        const compressedFile = tmpFile + '.gz';

        const cmd = 'mysqldump -u ' + escapeShellArg(STAMHOOFD.DB_USER) + ' -p' + escapeShellArg(STAMHOOFD.DB_PASS) + ' --flush-logs --single-transaction --quick --hex-blob --default-character-set=utf8mb4 --skip-extended-insert --max_allowed_packet=1G --triggers --routines --events --lock-tables=false ' + escapeShellArg(STAMHOOFD.DB_DATABASE) + ' > ' + escapeShellArg(tmpFile);

        console.log('Creating MySQL dump...');
        await execPromise(cmd);

        console.log('MySQL dump created at ' + tmpFile);

        // gzipping
        const cmd2 = `gzip -c ${escapeShellArg(tmpFile)} > ${escapeShellArg(compressedFile)}`;
        console.log('Compressing dump...');

        await execPromise(cmd2);
        console.log('MySQL dump compressed at ' + compressedFile);

        // Delete the uncompressed file
        await execPromise('rm ' + escapeShellArg(tmpFile));

        // Encrypt the compressed file using the public key in STAMHOOFD.publicEncryptionKey
        const encryptedFile = compressedFile + '.enc';
        const cmd3 = `gpg --recipient ${escapeShellArg(STAMHOOFD.keyFingerprint)} --encrypt --output ${escapeShellArg(encryptedFile)} ${escapeShellArg(compressedFile)}`;

        console.log('Encrypting dump...');
        await execPromise(cmd3);
        console.log('MySQL dump encrypted at ' + encryptedFile);

        // Delete the compressed file
        await execPromise('rm ' + escapeShellArg(compressedFile));

        // Upload

        // Download last backup file
        const client = getS3Client();

        // Create read stream
        const stream = fs.createReadStream(encryptedFile);
        const key = objectStoragePath + '/' + encryptedFile.split('/').pop();
        const fileSize = fs.statSync(encryptedFile).size;

        console.log('Calculating MD5...');
        const md5 = await hashFile(encryptedFile);

        console.log('Uploading backup to object storage at ' + key + '...');

        const command = new PutObjectCommand({
            Bucket: STAMHOOFD.SPACES_BUCKET,
            Key: key,
            Body: stream,
            ContentType: 'application/octet-stream',
            ContentLength: fileSize,
            ACL: 'private' as const,
            CacheControl: 'no-cache',
            ContentMD5: md5,
        });

        const response = await client.send(command);

        if (response.$metadata.httpStatusCode !== 200) {
            throw new Error('Failed to upload backup');
        }

        console.log(chalk.green('✓ Backup uploaded to object storage at ' + key));

        LAST_BACKUP = {
            date: new Date(),
            size: fileSize,
        };
    });
}

export async function backupBinlogs() {
    // Get all current binary logs
    // SHOW BINARY LOGS;

    const [firstRows] = await Database.select(`show variables like 'log_bin_basename'`);
    const logBinBaseName = firstRows[0]['session_variables']['Value'];

    if (!logBinBaseName || typeof logBinBaseName !== 'string') {
        throw new Error('log_bin_basename not found');
    }

    const binLogPath = path.dirname(logBinBaseName);

    const [rows] = await Database.select('SHOW BINARY LOGS');

    if (rows.length > MAX_BINARY_LOGS) {
        console.error(chalk.bold(chalk.red('Warning: MAX_BINARY_LOGS is larger than the binary logs stored on the system. Please check the MySQL configuration.')));

        // Only copy last MAX_BINARY_LOGS rows
        rows.splice(0, rows.length - MAX_BINARY_LOGS);
    }

    const lastRow = rows.pop();

    const allBinaryLogs = await listAllFiles(STAMHOOFD.objectStoragePath + '/binlogs');

    for (const row of rows) {
        const data = row[''];
        const logName = data['Log_name'];

        const fullPath = binLogPath + '/' + logName;
        await uploadBinaryLog(fullPath, false, true, allBinaryLogs);
    }

    // Upload partial lastRow
    if (lastRow) {
        const data = lastRow[''];
        const logName = data['Log_name'];

        const fullPath = binLogPath + '/' + logName;
        await uploadBinaryLog(fullPath, true, true, allBinaryLogs);
    }

    LAST_BINARY_BACKUP = {
        date: new Date(),
    };
}

export async function uploadBinaryLog(binaryLogPath: string, partial: boolean, gzip = true, allBinaryLogs: ObjectStorageFile[]) {
    const client = getS3Client();

    const number = parseInt(path.basename(binaryLogPath).split('.')[1]);
    if (isNaN(number) || !isFinite(number)) {
        throw new Error('Invalid binary log name: ' + binaryLogPath);
    }

    // Increase the padding to 10 digits so we never need to worry about number sorting issues in the long future
    const uploadedName = BINARY_LOG_PREFIX + number.toString().padStart(10, '0');

    if (!partial) {
        // Check if the file exists in S3
        const key = STAMHOOFD.objectStoragePath + '/binlogs/' + uploadedName + (gzip ? '.gz' : '') + '.enc';

        if (allBinaryLogs.find(f => f.key === key)) {
            // Delete partial if found
            await deletePartial(client, uploadedName, binaryLogPath, gzip, allBinaryLogs);
            return;
        }

        // Double check using HEAD
        try {
            await client.send(new HeadObjectCommand({
                Bucket: STAMHOOFD.SPACES_BUCKET,
                Key: key,
                ResponseCacheControl: 'no-cache',
            }));
            console.log('Binary log already exists: ' + uploadedName);
            return;
        }
        catch (e) {
            if (e.name !== 'NotFound') {
                throw e;
            }
            console.log('Binary log does not exist: ' + uploadedName);
        }
    }

    // Copy file to local backup folder and change ownership
    const localBackupFolder = STAMHOOFD.localBackupFolder;

    if (!localBackupFolder.endsWith('/')) {
        throw new Error('Backup folder should end with a /');
    }

    let binaryLogPathMoved = localBackupFolder + 'binlogs/' + uploadedName + (partial ? '.partial' : '');

    // Mkdir
    await execPromise('mkdir -p ' + escapeShellArg(path.dirname(binaryLogPathMoved)));

    await execPromise(`${STAMHOOFD.environment === 'development' ? '' : 'sudo '}cp ${escapeShellArg(binaryLogPath)} ${escapeShellArg(binaryLogPathMoved)}`);

    if (STAMHOOFD.environment !== 'development') {
        await execPromise(`sudo chown stamhoofd:stamhoofd ${escapeShellArg(binaryLogPathMoved)}`);
    }

    if (gzip) {
        // Compress the binary log
        const compressedFile = binaryLogPathMoved + '.gz';
        const cmd = `gzip -c ${escapeShellArg(binaryLogPathMoved)} > ${escapeShellArg(compressedFile)}`;
        console.log('Compressing ' + uploadedName + '...');
        await execPromise(cmd);
        console.log('Compressed at ' + compressedFile);

        // Delete the uncompressed file
        await execPromise('rm ' + escapeShellArg(binaryLogPathMoved));
        binaryLogPathMoved = compressedFile;
    }

    // Encrypt the compressed file using the public key in STAMHOOFD.publicEncryptionKey
    const encryptedFile = binaryLogPathMoved + '.enc';

    // Delete encrypted file if it exists
    try {
        await execPromise('rm ' + escapeShellArg(encryptedFile));
    }
    catch (e) {
        if (e.code !== 1) {
            throw e;
        }
    }

    const cmd3 = `gpg --recipient ${escapeShellArg(STAMHOOFD.keyFingerprint)} --encrypt --output ${escapeShellArg(encryptedFile)} ${escapeShellArg(binaryLogPathMoved)}`;

    console.log('Encrypting binlog...');
    await execPromise(cmd3);
    console.log('MySQL binlog encrypted at ' + encryptedFile);

    // Delete the compressed file
    await execPromise('rm ' + escapeShellArg(binaryLogPathMoved));

    // Calculate MD5
    console.log('Calculating MD5...');
    const md5 = await hashFile(encryptedFile);

    // Create read stream
    const stream = fs.createReadStream(encryptedFile);

    const key = STAMHOOFD.objectStoragePath + '/binlogs/' + path.basename(encryptedFile);

    const params = {
        Bucket: STAMHOOFD.SPACES_BUCKET,
        Key: key,
        Body: stream,
        ContentType: 'application/octet-stream',
        ContentLength: fs.statSync(encryptedFile).size,
        ACL: 'private' as const,
        CacheControl: 'no-cache',
        ContentMD5: md5,
    };

    console.log('Uploading binlog to ' + key + '...');
    const command = new PutObjectCommand(params);
    const response = await client.send(command);

    if (response.$metadata.httpStatusCode !== 200) {
        throw new Error('Failed to upload binlog');
    }

    console.log(chalk.green('✓ Binlog uploaded to ' + key));

    // Rm encrypted file
    await execPromise('rm ' + escapeShellArg(encryptedFile));

    if (!partial) {
        await deletePartial(client, uploadedName, binaryLogPath, gzip, allBinaryLogs);
    }
}

async function deletePartial(client: S3Client, uploadedName: string, binaryLogPath: string, gzip: boolean, allBinaryLogs: ObjectStorageFile[]) {
    // Check if a partial exists on the server and delete it to keep it clean
    const key = STAMHOOFD.objectStoragePath + '/binlogs/' + uploadedName + '.partial' + (gzip ? '.gz' : '') + '.enc';
    try {
        if (allBinaryLogs.find(f => f.key === key)) {
            console.log('Partial binary log exists at ' + key + ', which is no longer needed. Deleting...');

            await client.send(new DeleteObjectCommand({
                Bucket: STAMHOOFD.SPACES_BUCKET,
                Key: key,
            }));

            console.log('Partial binary log deleted');
        }
    }
    catch (e) {
        if (e.name !== 'NotFound') {
            throw e;
        }
    }
}
