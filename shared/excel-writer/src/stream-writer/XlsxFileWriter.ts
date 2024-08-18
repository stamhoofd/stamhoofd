export class XlsxFileWriter {
    /**
     * The sheet writer will write 
     */
    writeStream: WritableStream<Buffer>;
    writeStreamWriter?: WritableStreamDefaultWriter<Buffer>;

    async write(str: string) {
        console.log('Writing', str)
        if (!this.writeStreamWriter) {

            this.writeStreamWriter = this.writeStream.getWriter();
        }

        console.log('Waiting for ready')
        await this.writeStreamWriter.ready;

        console.log('Writing to stream')
        await this.writeStreamWriter.write(Buffer.from(str, 'utf8'));

        console.log('Done writing to stream')

        this.writeStreamWriter.releaseLock();
        this.writeStreamWriter = undefined
    }

    async close() {
        console.log('Closing writer')

        // Release writer
        if (this.writeStreamWriter) {
            // Call ready again to ensure that all chunks are written
            // before closing the writer.
            await this.writeStreamWriter.ready;

            await this.writeStreamWriter.close();
            this.writeStreamWriter = undefined;

            console.log('Closed writer')
        } else {
            console.warn('No writer to close: closing stream');
            await this.writeStream.close()

            console.log('Closed stream')
        }
    }
}
