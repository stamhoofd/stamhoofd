import { Database } from '@simonbackx/simple-database';
import { StyledText } from '@simonbackx/simple-logging';

class StaticSQLLogger {
    slowQueryThresholdMs: number | null = null;
    explainAllAndLogInefficient = false;

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

    async logInefficientExplainResult(query: string, params: any[], explainResult: any) {
        if (!explainResult) {
            return;
        }
        if (explainResult['type'] === 'ALL') {
            console.warn(
                new StyledText('[FULL TABLE SCAN] ').addClass('error').addTag('query'),
                'Inefficient query detected:',
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

        if (this.explainAllAndLogInefficient) {
            await this.logInefficientExplainResult(query, params, await this.explain(query, params));
            return result;
        }

        return result;
    }
}

export const SQLLogger = new StaticSQLLogger();
