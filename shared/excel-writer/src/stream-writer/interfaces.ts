/**
 * Allows to use different zip libraries
 */
export interface ZipWriterAdapter {
    addFile(name: string): Promise<WritableStream<Buffer>>;
    addDirectory(name: string): Promise<void>;

    /**
     * Called when all files have added (streams still in progress)
     */
    ready?(): Promise<void>;

    close(): Promise<void>;
    abort(): Promise<void>;
}
