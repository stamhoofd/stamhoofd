import { Database } from '@simonbackx/simple-database';
import { StyledText } from '@simonbackx/simple-logging';

class StaticSQLLogger {
    slowQueryThresholdMs: number | null = null;
    explainAllAndLogInefficient = false;
    customLoggers: ((query: string, params: any[], elapsedTimeMs: number) => void)[] = [];

    async explain(query: string, params: any[]) {
        // Run an EXPLAIN on the query to see what is going on
        try {
            const explainQuery = 'EXPLAIN ' + query;
            const [explainRows] = await Database.select(explainQuery, params, { nestTables: true });
            return explainRows[0]?.[''] ?? null;
        }
        catch (e) {
            console.error('Error running EXPLAIN on slow query', e);
        }
        return null;
    }

    async logInefficientExplainResult(query: string, params: any[], explainResult: any, elapsedTimeMs?: number) {
        if (!explainResult) {
            return;
        }
        if (elapsedTimeMs !== undefined && elapsedTimeMs < 20) {
            // Probably fine
            return;
        }

        if (explainResult['type'] === 'ALL') {
            console.warn(
                new StyledText('[FULL TABLE SCAN] ').addClass('error').addTag('query'),
                `Inefficient query detected${elapsedTimeMs !== undefined ? ' (' + elapsedTimeMs.toFixed(0) + 'ms)' : ''}:`,
                query,
                params,
                'EXPLAIN result:',
                explainResult,
            );
        }
    }

    async log<T>(queryPromise: Promise<T>, query: string, params: any[]): Promise<T> {
        if (this.slowQueryThresholdMs === null) {
            if (this.explainAllAndLogInefficient) {
                const result = await queryPromise;
                await this.logInefficientExplainResult(query, params, await this.explain(query, params));
                return result;
            }
            return queryPromise;
        }

        const startTime = process.hrtime.bigint();
        const result = await queryPromise;
        const elapsedTime = process.hrtime.bigint() - startTime;

        // Convert to ms
        const elapsedTimeMs = Number(elapsedTime) / 1000 / 1000;

        if (elapsedTimeMs > this.slowQueryThresholdMs) {
            console.trace('Slow SQL query (' + elapsedTimeMs.toFixed(2) + 'ms)\nQuery: ' + query, params);
        }

        for (const logger of this.customLoggers) {
            try {
                logger(query, params, elapsedTimeMs);
            }
            catch (e) {
                console.error('Error in custom SQL logger', e);
            }
        }

        if (this.explainAllAndLogInefficient) {
            await this.logInefficientExplainResult(query, params, await this.explain(query, params), elapsedTimeMs);
            return result;
        }

        return result;
    }
}

export const SQLLogger = new StaticSQLLogger();
