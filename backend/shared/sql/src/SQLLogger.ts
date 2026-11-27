import { errorDiagnostics } from '@common/errors';
import { Database } from '@node/database';
import { backendRecord } from '@node/logging';

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
        } catch (error) {
            console.error('EXPLAIN failed', errorDiagnostics(error));
            backendRecord('database.query.failed');
        }
        return null;
    }

    async logInefficientExplainResult(explainResult: any, elapsedTimeMs?: number) {
        if (!explainResult) {
            return;
        }
        if (elapsedTimeMs !== undefined && elapsedTimeMs < 20) {
            // Probably fine
            return;
        }

        if (explainResult['type'] === 'ALL') {
            console.warn('Full table scan', {
                estimatedRows:
                    typeof explainResult.rows === 'number' ? explainResult.rows : undefined,
            });
            backendRecord('database.query.slow', undefined, undefined, elapsedTimeMs);
        }
    }

    async log<T>(queryPromise: Promise<T>, query: string, params: any[]): Promise<T> {
        if (this.slowQueryThresholdMs === null) {
            if (this.explainAllAndLogInefficient) {
                const result = await queryPromise;
                await this.logInefficientExplainResult(await this.explain(query, params));
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
            backendRecord('database.query.slow', undefined, undefined, elapsedTimeMs);
        }

        for (const logger of this.customLoggers) {
            try {
                logger(query, params, elapsedTimeMs);
            } catch (error) {
                console.error('Error in custom SQL logger', errorDiagnostics(error));
            }
        }

        if (this.explainAllAndLogInefficient) {
            await this.logInefficientExplainResult(
                await this.explain(query, params),
                elapsedTimeMs,
            );
            return result;
        }

        return result;
    }
}

export const SQLLogger = new StaticSQLLogger();
