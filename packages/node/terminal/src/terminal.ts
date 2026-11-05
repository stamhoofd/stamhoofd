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

    get isTTY(): boolean { return this.output.isTTY; }

    createRegion(): TerminalRegion {
        const id = Symbol();
        this.regions.set(id, '');
        const dispose = () => { this.regions.delete(id); this.render(); };
        return {
            update: (content) => {
                if (!this.regions.has(id) || this.disposed) return;
                this.regions.set(id, content);
                this.render();
            },
            finish: (content) => { dispose(); if (content) this.write(`${content}\n`); },
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
    async withPrompt<T>(callback: () => Promise<T>): Promise<T> {
        this.suspended++;
        this.output.clearLive();
        try { return await callback(); } finally {
            if (--this.suspended === 0) {
                for (const { text, stream } of this.buffered) this.output.write(text, stream);
                if (this.dropped) this.output.write('\n[output omitted while terminal was suspended]\n');
                this.buffered = [];
                this.bufferedSize = 0;
                this.dropped = false;
                this.render();
            }
        }
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
