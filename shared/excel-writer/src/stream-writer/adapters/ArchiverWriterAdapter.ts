import { ZipWriterAdapter } from '../interfaces.js';
import { Writable } from 'node:stream';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import fs from 'node:fs';
import archiver from 'archiver';

export class ArchiverWriterAdapter implements ZipWriterAdapter {
    output: Writable;
    fileStreams: { tmpFile: string; fileName: string; stream: WritableStream<Buffer> }[] = [];

    constructor(output: Writable) {
        this.output = output;

        // setup
        // todo
    }

    async addFile(name: string): Promise<WritableStream<Buffer>> {
        const tmpDir = os.tmpdir() + '/stamhoofd-excel-writer';

        // generate random filename
        const tmpFilename = 'excel_writer_' + uuidv4();
        const filePath = tmpDir + '/' + tmpFilename;

        await fs.promises.mkdir(tmpDir, { recursive: true });

        const s = fs.createWriteStream(filePath, 'binary');

        s.on('close', () => {
            console.log('PassThrough closed file: File written to disk', filePath);
        });

        const webStream = Writable.toWeb(s) as WritableStream<Buffer>;

        this.fileStreams.push({ tmpFile: filePath, fileName: name, stream: webStream });

        return Promise.resolve(webStream);
    }

    async addDirectory(name: string): Promise<void> {
        // Empty directories are not supported by archiver
        // Directories should be created automatically when using addFile in this adapter
    }

    async ready() {
        return Promise.resolve();
    }

    /**
     * Note: make sure all writeable streams are closed before calling this
     */
    async close() {
        // All streams should be closed now

        const archive = archiver('zip', {
            zlib: { level: 9 }, // Sets the compression level.
            highWaterMark: 1,
        });

        // good practice to catch warnings (ie stat failures and other non-blocking errors)
        archive.on('warning', function (err) {
            if (err.code === 'ENOENT') {
                console.warn(err);
            }
            else {
                console.error(err);
                throw err;
            }
        });

        // good practice to catch this error explicitly
        archive.on('error', function (err) {
            console.error('Archiver error', err);
            throw err;
        });

        // pipe archive data to the file
        archive.pipe(this.output);

        // Pass to destionation stream
        for (const { tmpFile, fileName } of this.fileStreams) {
            console.log('File written to disk', tmpFile);

            // Create read stream
            archive.append(fs.createReadStream(tmpFile), { name: fileName });
        }

        await archive.finalize();

        // Clear all tmp files
        for (const { tmpFile } of this.fileStreams) {
            try {
                await fs.promises.unlink(tmpFile);
            }
            catch (e) {
                console.error('Error while deleting tmp file', tmpFile, e);
            }
        }
    }

    async abort() {
        for (const { stream } of this.fileStreams) {
            try {
                await stream.abort();
            }
            catch (e) {
                // Ignore
            }
        }

        // Clear all tmp files
        for (const { tmpFile } of this.fileStreams) {
            try {
                await fs.promises.unlink(tmpFile);
            }
            catch (e) {
                console.error('Error while deleting tmp file', tmpFile, e);
            }
        }
    }
}
