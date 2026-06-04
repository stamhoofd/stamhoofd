import type { SQLResultNamespacedRow } from '@simonbackx/simple-database';
import type { SQLSelect } from '@stamhoofd/sql';

export class LoggingTools {
    static async createProgressLoggerFromQuery<T extends object = SQLResultNamespacedRow>(query: SQLSelect<T>) {
        const total = await query.count();
        return new ProgressLogger(total);
    }
}

class ProgressLogger {
    private progress = 0;
    private progressedLogged = 0;
    private readonly onePercent: number;

    constructor(private readonly total: number) {
        this.onePercent = Math.floor(total / 100);
    }

    update(newProgress = 1) {
        this.progress += newProgress;

        if ((this.progress - this.progressedLogged) > this.onePercent) {
            this.progressedLogged = this.progress;
            process.stdout.write(`Progress: ${Math.floor(this.progressedLogged / this.total * 100)}%\r`);
            // console.log(`progress: ${Math.floor(this.progressedLogged / this.total * 100)}%\r`);
        }
    }
}
