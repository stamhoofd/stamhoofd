import { stripVTControlCharacters } from 'node:util';

/** Selects the destination for write(); live output is always drawn on stdout. */
export enum OutputStream {
    Stdout = 'stdout',
    Stderr = 'stderr',
}

/** Keeps a replaceable block of terminal output below ordinary stdout and stderr writes. */
export class StdSync {
    private readonly stdout: NodeJS.WriteStream;
    private readonly stderr: NodeJS.WriteStream;
    private readonly writeStdout: typeof process.stdout.write;
    private readonly writeStderr: typeof process.stderr.write;
    // The original bound writes bypass the temporary hooks when clearing or redrawing.
    private content = '';
    private lines = 0;
    // A write without a trailing newline leaves the cursor above the live block.
    private partial = false;

    /** Defaults to the process streams; pass streams explicitly when embedding or testing. */
    constructor(options: { stdout?: NodeJS.WriteStream; stderr?: NodeJS.WriteStream } = {}) {
        this.stdout = options.stdout ?? process.stdout;
        this.stderr = options.stderr ?? process.stderr;
        this.writeStdout = this.stdout.write.bind(this.stdout);
        this.writeStderr = this.stderr.write.bind(this.stderr);
    }

    get isTTY(): boolean {
        return !!this.stdout.isTTY;
    }

    /** Replace the live block. On non-TTY stdout this is a no-op. */
    setLive(content: string): void {
        if (!this.isTTY) {
            return;
        }
        if (!this.content) {
            // Intercept writes through these stream objects, including console output.
            this.stdout.write = ((chunk: string | Uint8Array, encoding?: BufferEncoding | ((error?: Error | null) => void), callback?: (error?: Error | null) => void) => this.write(chunk, OutputStream.Stdout, encoding, callback)) as typeof this.stdout.write;
            this.stderr.write = ((chunk: string | Uint8Array, encoding?: BufferEncoding | ((error?: Error | null) => void), callback?: (error?: Error | null) => void) => this.write(chunk, OutputStream.Stderr, encoding, callback)) as typeof this.stderr.write;
        }
        this.clear();
        this.content = content;
        if (!this.partial) {
            this.render();
        }
    }

    /** Write to either stream, temporarily moving the live block out of the way. */
    write(chunk: string | Uint8Array, stream: OutputStream = OutputStream.Stdout, encoding?: BufferEncoding | ((error?: Error | null) => void), callback?: (error?: Error | null) => void): boolean {
        if (this.content && !this.partial) {
            this.clear();
        }
        const result = stream === OutputStream.Stdout
            ? this.writeStdout(chunk, encoding as BufferEncoding, callback)
            : this.writeStderr(chunk, encoding as BufferEncoding, callback);
        if (this.content) {
            // Wait for a complete line before redrawing, so split writes remain contiguous.
            this.partial = !/[\r\n]$/.test(String(chunk));
            if (!this.partial) {
                this.render();
            }
        }
        return result;
    }

    /** Erase the live block and restore the original stream writes. */
    clearLive(): void {
        if (!this.content) {
            return;
        }
        this.clear();
        this.content = '';
        this.lines = 0;
        this.partial = false;
        this.stdout.write = this.writeStdout;
        this.stderr.write = this.writeStderr;
    }

    /** Keep the last live block visible as ordinary output and restore stream writes. */
    done(): void {
        if (!this.content) {
            return;
        }
        if (this.partial) {
            // A partial log must finish before the live block can become permanent.
            this.writeStdout('\n');
            this.partial = false;
            this.render();
        }
        this.content = '';
        this.lines = 0;
        this.stdout.write = this.writeStdout;
        this.stderr.write = this.writeStderr;
    }

    private clear(): void {
        if (this.lines) {
            // Move to the start of the rendered block, then erase to the bottom.
            this.writeStdout(`\x1b[${this.lines}A\x1b[0J`);
            this.lines = 0;
        }
    }

    private render(): void {
        if (this.content) {
            this.writeStdout(`${this.content}\n`);
            const columns = this.stdout.columns;
            // Count terminal rows rather than newline-delimited lines: text may wrap.
            this.lines = this.content.split('\n').reduce((lines, line) => {
                const width = stripVTControlCharacters(line).length;
                return lines + (columns ? Math.max(1, Math.ceil(width / columns)) : 1);
            }, 0);
        }
    }
}
