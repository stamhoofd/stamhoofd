import archiver from 'archiver';
import { ZipWriterAdapter } from '../interfaces';
import { PassThrough, Readable, Writable } from "node:stream"

export class ArchiverWriterAdapter implements ZipWriterAdapter {
    writer: WritableStream<Buffer>;
    archive: archiver.Archiver
    finalizePromise: Promise<void> | undefined;

    /**
     * All pending writes we'll need to await
     */
    pendingFileWrites: Promise<any>[] = [];
    
    /**
     * @param writer The data of the zip file will be written to this stream
     */
    constructor(writer: WritableStream<Buffer>) {
        const output = Writable.fromWeb(writer)

        output.on('close', () => {
            console.log('Archiver has been finalized and the output file descriptor has closed: ' + this.archive.pointer() + ' total bytes');
        });

        output.on('end', function() {
            console.log('Data has been drained');
          });

        output.on('error', (e) => {
            console.error('Error in output stream', e)
            throw e;
        });
          
        this.archive = archiver('zip', {
            zlib: { level: 9 } // Sets the compression level.
        });

        // good practice to catch warnings (ie stat failures and other non-blocking errors)
        this.archive.on('warning', function(err) {
            if (err.code === 'ENOENT') {
                console.warn(err)
            } else {
                console.error(err)
                throw err;
            }
        });
        
        // good practice to catch this error explicitly
        this.archive.on('error', function(err) {
            console.error('Archiver error', err)
            throw err;
        });
        
        // pipe archive data to the file
        this.archive.pipe(output);
    }

    addFile(name: string): Promise<WritableStream<Buffer>> {
        // Create a new writeable stream that writes to a reader that we'll pass to zipWriter
        const stream = new PassThrough({})

        stream.on('end', () => {
            console.log('Finished file', name)
        });

        stream.on('close', () => {
            console.log('Closed file stream', name)
        });

        stream.on('error', (err) => {
            console.error('Error in PassThrough stream', name, err)
            //throw err;
        });

        this.archive.append(stream, { name });
        return Promise.resolve(Writable.toWeb(stream))
    }

    async addDirectory(name: string): Promise<void> {
        // Empty directories are not supported by archiver
        // Directories should be created automatically when using addFile in this adapter
    }

    async ready() {
        this.finalizePromise = this.archive.finalize();
        return Promise.resolve()
    }

    /**
     * Note: make sure all writeable streams are closed before calling this
     */
    async close() {
        return await this.finalizePromise;
    }

    async abort() {
        //this.archive.abort();
        await this.finalizePromise;
    }
}
