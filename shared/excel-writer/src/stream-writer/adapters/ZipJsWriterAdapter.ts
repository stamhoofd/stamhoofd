import zip, {
    ZipWriter
} from '@zip.js/zip.js';
import { ZipWriterAdapter } from '../interfaces';

export class ZipJsWriterAdapter implements ZipWriterAdapter {
    writer: WritableStream<Buffer>;
    zipWriter: ZipWriter<Buffer>;

    /**
     * All pending writes we'll need to await
     */
    pendingFileWrites: Promise<any>[] = [];
    
    /**
     * @param writer The data of the zip file will be written to this stream
     */
    constructor(writer: WritableStream<Buffer>) {
        this.writer = writer;
        zip.configure({ chunkSize: 128 });
        this.zipWriter = new ZipWriter(writer, {bufferedWrite: true});
    }

    addFile(name: string): Promise<WritableStream<Buffer>> {
        // Create a new writeable stream that writes to a reader that we'll pass to zipWriter
        const stream = new TransformStream<Buffer, Buffer>(
            undefined, 
            new CountQueuingStrategy({ highWaterMark: 100 }),
            new CountQueuingStrategy({ highWaterMark: 10000 })
        );

        this.pendingFileWrites.push(
            this.zipWriter.add(name, {readable: stream.readable, size: 10000}).then(() => {
                console.log('Finished file', name)
            }).catch((e) => {
                console.error('Error writing file', name, e)
            })
            //stream.readable.pipeTo(this.writer)
        )
        
        return Promise.resolve(stream.writable)
    }

    async addDirectory(name: string): Promise<void> {
        await this.zipWriter.add(name, undefined, {directory: true})
    }

    /**
     * Note: make sure all writeable streams are closed before calling this
     */
    async close() {
        console.log('Awaiting pending file writes')
        await Promise.all(this.pendingFileWrites);

        console.log('Closing zip writer')
        await this.zipWriter.close();
    }

    async abort() {
        await this.zipWriter.close();
    }
}
