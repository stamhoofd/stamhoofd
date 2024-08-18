export class XlsxFileWriter {
    /**
     * The sheet writer will write 
     */
    writeStream: WritableStream<Buffer>;
    writeStreamWriter?: WritableStreamDefaultWriter<Buffer>;

    async write(str: string) {
        if (!this.writeStreamWriter) {
            this.writeStreamWriter = this.writeStream.getWriter();
        }

        await this.writeStreamWriter.ready;
        await this.writeStreamWriter.write(Buffer.from(str, 'utf8'));
    }

    async close() {
        // Release writer
        if (this.writeStreamWriter) {
            await this.writeStreamWriter.ready;
            await this.writeStreamWriter.close();
            this.writeStreamWriter = undefined;
        } else {
            await this.writeStream.close()
        }
    }

    async abort() {
        if (this.writeStreamWriter) {
            await this.writeStreamWriter.ready;
            await this.writeStreamWriter.close();
            this.writeStreamWriter = undefined;
        } else {
            await this.writeStream.close()
        }
    }
}
