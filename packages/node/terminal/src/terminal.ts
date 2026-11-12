import { OutputStream, StdSync } from './stdsync.js';

export type TerminalRegion = {
    update(content: string): void;
    finish(content?: string): void;
    dispose(): void;
};

/** One application-owned coordinator per pair of streams. */
export class Terminal {
    private readonly output: StdSync;
    private readonly regions = new Map<symbol, string>();
    private suspended = 0;
    private buffered: { text: string; stream: OutputStream }[] = [];
    private bufferedSize = 0;
    private dropped = false;
    private disposed = false;

    constructor(options: { stdout?: NodeJS.WriteStream; stderr?: NodeJS.WriteStream } = {}) {
        this.output = new StdSync(options);
    }

    get isTTY(): boolean {
        return this.output.isTTY;
    }
    /** Actual destination for live regions and default writes; use for capability detection. */
    get stream(): NodeJS.WriteStream {
        return this.output.stream;
    }
    get isSuspended(): boolean {
        return this.suspended > 0 || this.disposed;
    }

    createRegion(): TerminalRegion {
        const id = Symbol();
        this.regions.set(id, '');
        const dispose = () => {
            this.regions.delete(id);
            this.render();
        };
        return {
            update: (content) => {
                if (!this.regions.has(id) || this.disposed) return;
                this.regions.set(id, content);
                this.render();
            },
            finish: (content) => {
                dispose();
                if (content) this.write(`${content}\n`);
            },
            dispose,
        };
    }

    write(chunk: string | Uint8Array, stream = OutputStream.Stdout): boolean {
        if (this.disposed) return false;
        if (!this.suspended) return this.output.write(chunk, stream);
        const text = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
        if (this.bufferedSize + text.length <= 65536) {
            this.buffered.push({ text, stream });
            this.bufferedSize += text.length;
        } else this.dropped = true;
        return true;
    }

    /** The callback owns direct stream writes; coordinated writes are deferred (64 KiB maximum). */
    async withPrompt<T>(callback: (write: (text: string) => boolean) => Promise<T>): Promise<T> {
        this.suspended++;
        this.output.clearLive();
        try {
            return await callback((text) => {
                this.output.write(text);
                return true;
            });
        } finally {
            if (--this.suspended === 0) {
                for (const { text, stream } of this.buffered) this.output.write(text, stream);
                if (this.dropped)
                    this.output.write('\n[output omitted while terminal was suspended]\n');
                this.buffered = [];
                this.bufferedSize = 0;
                this.dropped = false;
                this.render();
            }
        }
    }

    /** Short, line-oriented interactions: replace successful output; retain failures and complex terminal output. */
    async withTransientOutput<T>(
        pending: string,
        callback: (write: (text: string) => boolean) => Promise<T>,
        completed: (success: boolean) => string,
    ): Promise<T> {
        return this.withPrompt(async () => {
            const columns = this.output.columns;
            const rows = this.output.rows;
            let visible = '';
            let replaceable = this.isTTY;
            let newline = true;
            const write = (text: string): boolean => {
                // eslint-disable-next-line no-control-regex -- Only SGR styling is safe to ignore when counting terminal rows.
                const plain = text.replace(/\x1b\[[0-9;]*m/g, '');
                // Cursor controls, wide characters and scrolling require keeping the original output.
                if (/[^\x20-\x7e\n]/.test(plain) || visible.length + plain.length > columns * rows)
                    replaceable = false;
                if (replaceable) visible += plain;
                if (text) newline = text.endsWith('\n');
                this.output.write(text);
                return true;
            };
            write(`${pending}\n`);
            const finish = (success: boolean) => {
                const lines = visible.split('\n');
                const last = lines.pop()!;
                const height =
                    lines.reduce(
                        (total, line) => total + Math.max(1, Math.ceil(line.length / columns)),
                        0,
                    ) + Math.floor(Math.max(0, last.length - 1) / columns);
                if (
                    success &&
                    replaceable &&
                    height < rows &&
                    columns === this.output.columns &&
                    rows === this.output.rows
                ) {
                    this.output.write(`\r${height ? `\x1b[${height}A` : ''}\x1b[0J`);
                } else if (!newline) this.output.write('\n');
                this.output.write(`${completed(success)}\n`);
            };
            try {
                const result = await callback(write);
                finish(true);
                return result;
            } catch (error) {
                finish(false);
                throw error;
            }
        });
    }

    dispose(): void {
        this.disposed = true;
        this.regions.clear();
        this.output.clearLive();
    }

    private render(): void {
        if (this.suspended || this.disposed) return;
        const content = [...this.regions.values()].filter(Boolean).join('\n');
        if (content) this.output.setLive(content);
        else this.output.clearLive();
    }
}
