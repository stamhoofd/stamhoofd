import type { XlsxTransformerSheet, XlsxWorkbookFilter, ZipWriterAdapter } from '@stamhoofd/excel-writer';
import { exportToExcel as exportToExcelHelper, XlsxWriter } from '@stamhoofd/excel-writer';
import type { IPaginatedResponse, LimitedFilteredRequest } from '@stamhoofd/structures';

async function exportToExcel<T>(filter: XlsxWorkbookFilter, definitions: XlsxTransformerSheet<T, unknown>[], dataGenerator: AsyncIterable<T[]>) {
    const adapter = new SimpleAdapter();
    const writer = new XlsxWriter(adapter);

    await exportToExcelHelper({
        filter,
        definitions,
        writer,
        dataGenerator,
    });
}

class SimpleAdapter implements ZipWriterAdapter {
    async addFile(name: string): Promise<WritableStream<Buffer>> {
        // todo
        // const tmpDir = os.tmpdir() + '/stamhoofd-excel-writer';

        // // generate random filename
        // const tmpFilename = 'excel_writer_' + uuidv4();
        // const filePath = tmpDir + '/' + tmpFilename;

        // await fs.promises.mkdir(tmpDir, { recursive: true });

        // const s = fs.createWriteStream(filePath, 'binary');

        // s.on('close', () => {
        //     console.log('PassThrough closed file: File written to disk', filePath);
        // });
        throw new Error('not implemented');

        // const webStream = Writable.toWeb(s) as WritableStream<Buffer>;

        // // this.fileStreams.push({ tmpFile: filePath, fileName: name, stream: webStream });

        // return Promise.resolve(webStream);
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
        // // All streams should be closed now

        // const archive = archiver('zip', {
        //     zlib: { level: 9 }, // Sets the compression level.
        //     highWaterMark: 1,
        // });

        // // good practice to catch warnings (ie stat failures and other non-blocking errors)
        // archive.on('warning', function (err) {
        //     if (err.code === 'ENOENT') {
        //         console.warn(err);
        //     } else {
        //         console.error(err);
        //         throw err;
        //     }
        // });

        // // good practice to catch this error explicitly
        // archive.on('error', function (err) {
        //     console.error('Archiver error', err);
        //     throw err;
        // });

        // // pipe archive data to the file
        // archive.pipe(this.output);

        // // Pass to destionation stream
        // for (const { tmpFile, fileName } of this.fileStreams) {
        //     console.log('File written to disk', tmpFile);

        //     // Create read stream
        //     archive.append(fs.createReadStream(tmpFile), { name: fileName });
        // }

        // await archive.finalize();

        // // Clear all tmp files
        // for (const { tmpFile } of this.fileStreams) {
        //     try {
        //         await fs.promises.unlink(tmpFile);
        //     } catch (e) {
        //         console.error('Error while deleting tmp file', tmpFile, e);
        //     }
        // }
        // todo
    }

    async abort() {
        // for (const { stream } of this.fileStreams) {
        //     try {
        //         await stream.abort();
        //     } catch (e) {
        //         // Ignore
        //     }
        // }

        // // Clear all tmp files
        // for (const { tmpFile } of this.fileStreams) {
        //     try {
        //         await fs.promises.unlink(tmpFile);
        //     } catch (e) {
        //         console.error('Error while deleting tmp file', tmpFile, e);
        //     }
        // }
        // todo
    }
}

export function fetchToAsyncIterator<T>(
    initialFilter: LimitedFilteredRequest,
    loader: {
        fetch(request: LimitedFilteredRequest): Promise<IPaginatedResponse<T, LimitedFilteredRequest>>;
    },
): AsyncIterable<T> {
    return {
        [Symbol.asyncIterator]: function () {
            let request: LimitedFilteredRequest | null = initialFilter;

            return {
                async next(): Promise<IteratorResult<T, undefined>> {
                    if (!request) {
                        return {
                            done: true,
                            value: undefined,
                        };
                    }

                    const response = await loader.fetch(request);
                    request = response.next ?? null;

                    return {
                        done: false,
                        value: response.results,
                    };
                },
            };
        },
    };
}
