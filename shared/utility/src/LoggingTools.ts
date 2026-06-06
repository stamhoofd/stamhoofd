export class LoggingTools {
    static createProgressLogger(total: number, options?: ProgressLoggerOptions) {
        return new ProgressLogger(total, options);
    }

    static async createProgressLoggerFromQuery(query: { count: () => Promise<number> }, options?: ProgressLoggerOptions) {
        const total = await query.count();
        return this.createProgressLogger(total, options);
    }
}

export type ProgressLoggerOptions = {
    tag?: string;
};

export class ProgressLogger {
    private progress = 0;
    private progressedLogged = 0;
    private readonly onePercent: number;
    private readonly prefix: string;

    constructor(readonly total: number, { tag }: ProgressLoggerOptions = {}) {
        this.onePercent = Math.floor(total / 100);
        this.prefix = tag ? `[${tag}] progress` : 'Progress';

        if (total === 0) {
            this.writeOutput(this.formatProgress(100), false);
        } else {
            this.writeOutput(this.formatProgress(0), false);
        }
    }

    update(newProgress = 1) {
        this.progress += newProgress;

        if (this.progress === this.total) {
            this.progressedLogged = this.total;
            this.writeOutput(this.formatProgress(100), true);
            return;
        }

        if ((this.progress - this.progressedLogged) > this.onePercent) {
            this.progressedLogged = this.progress;
            const progress = Math.floor(this.progressedLogged / this.total * 100);
            this.writeOutput(this.formatProgress(progress), true);
        }
    }

    private formatProgress(progress: number) {
        return `${this.prefix}: ${progress}%`;
    }

    private writeOutput(text: string, replaceLine = false) {
        if (replaceLine) {
            text = '\r' + text;
        }
        process.stdout.write(text);
    }
}
