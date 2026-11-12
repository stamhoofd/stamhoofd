import { ArchiverWriterAdapter } from '@stamhoofd/excel-writer';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { afterEach, expect, it, vi } from 'vitest';

let directory: string;

afterEach(async () => {
    vi.restoreAllMocks();
    if (directory) {
        await fs.rm(directory, { recursive: true, force: true });
    }
});

it('finishes the ZIP before removing its private temporary directory', async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'excel-security-'));
    vi.spyOn(os, 'tmpdir').mockReturnValue(directory);
    const chunks: Buffer[] = [];
    const output = new Writable({
        write(chunk: Buffer, _encoding, callback) {
            chunks.push(chunk);
            callback();
        },
    });
    const adapter = new ArchiverWriterAdapter(output);
    const writer = (await adapter.addFile('sheet.xml')).getWriter();
    await writer.write(Buffer.from('<sheet/>'));
    await writer.close();
    writer.releaseLock();
    await adapter.close();
    await finished(output);
    expect(Buffer.concat(chunks).subarray(0, 2).toString()).toBe('PK');
    expect(await fs.readdir(directory)).toEqual([]);
});

it('keeps export data outside a pre-created shared directory and removes private temporary files on abort', async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'excel-security-'));
    vi.spyOn(os, 'tmpdir').mockReturnValue(directory);
    const hostileDirectory = path.join(directory, 'attacker-controlled');
    await fs.mkdir(hostileDirectory);
    await fs.symlink(hostileDirectory, path.join(directory, 'stamhoofd-excel-writer'));
    const adapter = new ArchiverWriterAdapter(
        new Writable({
            write(_chunk, _encoding, callback) {
                callback();
            },
        }),
    );
    const stream = await adapter.addFile('sheet.xml');
    const writer = stream.getWriter();
    const filePath = adapter.fileStreams[0].tmpFile;

    try {
        await writer.write(Buffer.from('private export data'));
        await writer.close();
        expect(await fs.readdir(hostileDirectory)).toEqual([]);
        expect(await fs.readFile(filePath, 'utf8')).toBe('private export data');
        expect((await fs.stat(path.dirname(filePath))).mode & 0o777).toBe(0o700);
        expect((await fs.stat(filePath)).mode & 0o777).toBe(0o600);
    } finally {
        writer.releaseLock();
        await adapter.abort();
    }
    await expect(fs.stat(path.dirname(filePath))).rejects.toMatchObject({ code: 'ENOENT' });
});
