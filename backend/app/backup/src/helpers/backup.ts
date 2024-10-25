import { Formatter } from '@stamhoofd/utility';
import { exec } from 'child_process';
import util from 'util';
const execPromise = util.promisify(exec);
import { S3Client, ListObjectsCommand, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'; // ES Modules import
import fs from 'fs';
import path from 'path';
import { Database } from '@simonbackx/simple-database';
import chalk from 'chalk';

export function escapeShellArg(arg) {
    return `'${arg.replace(/'/g, `'\\''`)}'`;
}

export async function diskSpace(): Promise<number> {
    if (process.env.NODE_ENV === 'development') {
        // Not working in MacOS
        return 1000000000000;
    }

    const result = await execPromise('df --output=avail --block-size=1 /');
    const parts = result.stdout.split('\n');
    if (parts.length !== 2 || parts[0].trim() !== 'Avail') {
        throw new Error('Unexected result for df cmd');
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

export async function backup() {
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
    if (availableDiskSpace < 10) {
        throw new Error('Less than 10GB disk space available. Avoid creating backups now until this has been resolved.');
    }

    // Recreate folder
    await execPromise('mkdir -p ' + escapeShellArg(localBackupFolder));

    const timestamp = Formatter.dateIso(new Date()) + '-' + Formatter.timeIso(new Date()).replace(':', 'h');
    const tmpFile = `${localBackupFolder}backup-${timestamp}.sql`;
    const compressedFile = tmpFile + '.gz';

    const cmd = 'mysqldump -u ' + escapeShellArg(STAMHOOFD.DB_USER) + ' -p' + escapeShellArg(STAMHOOFD.DB_PASS) + ' --flush-logs --single-transaction --triggers --routines --events --lock-tables=false ' + escapeShellArg(STAMHOOFD.DB_DATABASE) + ' > ' + escapeShellArg(tmpFile);

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

    const params = {
        Bucket: STAMHOOFD.SPACES_BUCKET,
        Key: key,
        Body: stream,
        ContentType: 'application/octet-stream',
        ContentLength: fs.statSync(encryptedFile).size,
        ACL: 'private' as const,
        CacheControl: 'no-cache',
    };

    console.log('Uploading backup to object storage at ' + key + '...');

    const command = new PutObjectCommand(params);
    const response = await client.send(command);

    if (response.$metadata.httpStatusCode !== 200) {
        throw new Error('Failed to upload backup');
    }

    console.log(chalk.green('✓ Backup uploaded to object storage at ' + key));
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
    const lastRow = rows.pop();

    for (const row of rows) {
        const data = row[''];
        const logName = data['Log_name'];

        const fullPath = binLogPath + '/' + logName;
        console.log('Found ' + fullPath);

        await uploadBinaryLog(fullPath, false, true);
    }

    // Upload partial lastRow
    if (lastRow) {
        const data = lastRow[''];
        const logName = data['Log_name'];

        const fullPath = binLogPath + '/' + logName;
        console.log('Found ' + fullPath);

        await uploadBinaryLog(fullPath, true, true);
    }
}

export async function uploadBinaryLog(binaryLogPath: string, partial: boolean, gzip = true) {
    const client = getS3Client();

    if (!partial) {
        // Check if the file exists in S3
        const key = STAMHOOFD.objectStoragePath + '/binlogs/' + path.basename(binaryLogPath) + (gzip ? '.gz' : '') + '.enc';
        try {
            await client.send(new HeadObjectCommand({
                Bucket: STAMHOOFD.SPACES_BUCKET,
                Key: key,
                ResponseCacheControl: 'no-cache',
            }));
            console.log('Binary log already exists at ' + key);
            return;
        }
        catch (e) {
            if (e.name !== 'NotFound') {
                throw e;
            }
            console.log('Binary log does not exist yet at ' + key);
        }
    }

    // Copy file to local backup folder and change ownership
    const localBackupFolder = STAMHOOFD.localBackupFolder;

    if (!localBackupFolder.endsWith('/')) {
        throw new Error('Backup folder should end with a /');
    }

    let binaryLogPathMoved = localBackupFolder + 'binlogs/' + path.basename(binaryLogPath) + (partial ? '.partial' : '');

    // Mkdir
    await execPromise('mkdir -p ' + escapeShellArg(path.dirname(binaryLogPathMoved)));

    await execPromise(`${STAMHOOFD.environment === 'development' ? '' : 'sudo '}cp ${escapeShellArg(binaryLogPath)} ${escapeShellArg(binaryLogPathMoved)}`);

    if (STAMHOOFD.environment !== 'development') {
        await execPromise(`chown stamhoofd:stamhoofd ${escapeShellArg(binaryLogPathMoved)}`);
    }

    if (gzip) {
        // Compress the binary log
        const compressedFile = binaryLogPathMoved + '.gz';
        const cmd = `gzip -c ${escapeShellArg(binaryLogPathMoved)} > ${escapeShellArg(compressedFile)}`;
        console.log('Compressing binary log...');
        await execPromise(cmd);
        console.log('Binary log compressed at ' + compressedFile);

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

    // Upload

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
    };

    console.log('Uploading binlog to object storage at ' + key + '...');
    const command = new PutObjectCommand(params);
    const response = await client.send(command);

    if (response.$metadata.httpStatusCode !== 200) {
        throw new Error('Failed to upload binlog');
    }

    console.log(chalk.green('✓ Binlog uploaded to object storage at ' + key));

    // Rm encrypted file
    await execPromise('rm ' + escapeShellArg(encryptedFile));

    if (!partial) {
        // Check if a partial exists on the server and delete it to keep it clean
        const key = STAMHOOFD.objectStoragePath + '/binlogs/' + path.basename(binaryLogPath) + '.partial' + (gzip ? '.gz' : '') + '.enc';
        try {
            await client.send(new HeadObjectCommand({
                Bucket: STAMHOOFD.SPACES_BUCKET,
                Key: key,
                ResponseCacheControl: 'no-cache',
            }));
            console.log('Partial binary log exists at ' + key + ', which is no longer needed. Deleting...');

            await client.send(new DeleteObjectCommand({
                Bucket: STAMHOOFD.SPACES_BUCKET,
                Key: key,
            }));

            console.log('Partial binary log deleted');
        }
        catch (e) {
            if (e.name !== 'NotFound') {
                throw e;
            }
        }
    }
}
