import type { SQLResultNamespacedRow } from '@simonbackx/simple-database';
import type { SQLSelect } from '@stamhoofd/sql';

export class LoggingTools {
    static createProgressLogger(total: number) {
        return new ProgressLogger(total);
    }

    static async createProgressLoggerFromQuery<T extends object = SQLResultNamespacedRow>(query: SQLSelect<T>) {
        const total = await query.count();
        return this.createProgressLogger(total);
    }
}

class ProgressLogger {
    private progress = 0;
    private progressedLogged = 0;
    private readonly onePercent: number;

    constructor(readonly total: number) {
        this.onePercent = Math.floor(total / 100);
        this.writeOutput(this.formatProgress(0), false);
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
        return `Progress: ${progress}%`;
    }

    private writeOutput(text: string, replaceLine = false) {
        if (replaceLine) {
            text = '\r' + text;
        }
        process.stdout.write(text);
    }
}
