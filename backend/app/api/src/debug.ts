import { Column } from '@simonbackx/simple-database';
import { EncodedResponse, ResponseMiddleware, Router, RouterServer } from '@simonbackx/simple-endpoints';
import { logger } from '@simonbackx/simple-logging';
import { requestPrefix } from '@stamhoofd/backend-middleware';

import { AutoEncoder } from '@simonbackx/simple-encoding';
import { Request, Response } from '@simonbackx/simple-endpoints';
import { SQLLogger } from '@stamhoofd/sql';
import { ContextInstance } from './helpers/Context.js';

export function loadDebugFunctions({ routerServer }: { routerServer: RouterServer }) {
    SQLLogger.slowQueryThresholdMs = 75;
    SQLLogger.explainAllAndLogInefficient = true;

    if (process.env.LOG_REQUEST_QUERIES) {
        loadRequestQueries({ routerServer });
    }

    if (process.env.LOG_TIMERS) {
        loadTimers({ routerServer });
    }
}

export function loadRequestQueries({ routerServer }: { routerServer: RouterServer }) {
    SQLLogger.customLoggers.push((query, params, elapsedTimeMs) => {
        const context = ContextInstance.optional;
        if (context) {
            context.queries.push({ query, time: elapsedTimeMs });
        }
    });
    const LogQueriesMiddleware: ResponseMiddleware = {
        handleResponse(request: Request, response: Response, error?: Error) {
            const prefix = !error ? [] : requestPrefix(request, 'error');
            const context = (request as any)._context as ContextInstance | undefined;

            if (context && request.method !== 'OPTIONS') {
                logger.log(
                    ...prefix,
                    ' - Queries ' + context.queries.map(q => `\n- ${q.query} (${q.time?.toFixed(2) ?? '-'}ms)`).join(''),
                );
            }
        },
    };
    routerServer.addResponseMiddleware(LogQueriesMiddleware);
}

export function loadTimers({ routerServer }: { routerServer: RouterServer }) {
    const jsonStringify = JSON.stringify;
    JSON.stringify = function (...args) {
        const startTime = process.hrtime.bigint();
        const result = jsonStringify.apply(this, args);
        const elapsedTime = process.hrtime.bigint() - startTime;
        const elapsedTimeMs = Number(elapsedTime) / 1000 / 1000;

        if (elapsedTimeMs > 1) {
            console.log('JSON.stringify took ' + elapsedTimeMs.toFixed(2) + 'ms');
        }
        // Count total request
        const context = ContextInstance.optional;
        if (context) {
            context.timers.set('JSON.stringify', (context.timers.get('JSON.stringify') ?? 0) + elapsedTimeMs);
        }
        return result;
    };

    const jsonParse = JSON.parse;
    JSON.parse = function (...args) {
        const startTime = process.hrtime.bigint();
        const result = jsonParse.apply(this, args);
        const elapsedTime = process.hrtime.bigint() - startTime;
        const elapsedTimeMs = Number(elapsedTime) / 1000 / 1000;

        if (elapsedTimeMs > 1) {
            console.log('JSON.parse took ' + elapsedTimeMs.toFixed(2) + 'ms');
        }

        // Count total request
        const context = ContextInstance.optional;
        if (context) {
            context.timers.set('JSON.parse', (context.timers.get('JSON.parse') ?? 0) + elapsedTimeMs);
        }
        return result;
    };

    const routerDecode = Router.prototype.decode;
    Router.prototype.decode = function (...args) {
        const startTime = process.hrtime.bigint();
        const result = routerDecode.apply(this, args);
        const elapsedTime = process.hrtime.bigint() - startTime;
        const elapsedTimeMs = Number(elapsedTime) / 1000 / 1000;

        if (elapsedTimeMs > 1) {
            console.log('Router.decode took ' + elapsedTimeMs.toFixed(2) + 'ms');
        }

        // Count total request
        const context = ContextInstance.optional;
        if (context) {
            context.timers.set('Router.decode', (context.timers.get('Router.decode') ?? 0) + elapsedTimeMs);
        }
        return result;
    };

    const encodedResponseEncode = EncodedResponse.encode;
    EncodedResponse.encode = function (...args) {
        const startTime = process.hrtime.bigint();
        const result = encodedResponseEncode.apply(this, args);
        const elapsedTime = process.hrtime.bigint() - startTime;
        const elapsedTimeMs = Number(elapsedTime) / 1000 / 1000;

        if (elapsedTimeMs > 1) {
            console.log('EncodedResponse.encode took ' + elapsedTimeMs.toFixed(2) + 'ms');
        }

        // Count total request
        const context = ContextInstance.optional;
        if (context) {
            context.timers.set('EncodedResponse.encode', (context.timers.get('EncodedResponse.encode') ?? 0) + elapsedTimeMs);
        }

        return result;
    };

    // Change
    const columnTo = Column.prototype.to;
    Column.prototype.to = function (this: Column, value: any) {
        const startTime = process.hrtime.bigint();
        const result = columnTo.apply(this, [value]);
        const elapsedTime = process.hrtime.bigint() - startTime;
        const elapsedTimeMs = Number(elapsedTime) / 1000 / 1000;

        if (elapsedTimeMs > 1) {
            console.log(`Column.to for ${this.constructor.name} took ${elapsedTimeMs.toFixed(2)}ms`);
        }

        // Count total request
        const context = ContextInstance.optional;
        if (context) {
            context.timers.set(`Column.to`, (context.timers.get(`Column.to`) ?? 0) + elapsedTimeMs);
        }
        return result;
    };

    const columnFrom = Column.prototype.from;
    Column.prototype.from = function (this: Column, value: any) {
        const startTime = process.hrtime.bigint();
        const result = columnFrom.apply(this, [value]);
        const elapsedTime = process.hrtime.bigint() - startTime;
        const elapsedTimeMs = Number(elapsedTime) / 1000 / 1000;

        if (elapsedTimeMs > 1) {
            console.log(`Column.from for ${this.constructor.name} took ${elapsedTimeMs.toFixed(2)}ms`);
        }

        // Count total request
        const context = ContextInstance.optional;
        if (context) {
            context.timers.set(`Column.from`, (context.timers.get(`Column.from`) ?? 0) + elapsedTimeMs);
        }
        return result;
    };

    const decode = AutoEncoder.decode;
    AutoEncoder.decode = function (...args) {
        const c = args[0].context as any;
        if (c._didTrack) {
            return decode.apply(this, args);
        }
        c._didTrack = true;

        const startTime = process.hrtime.bigint();
        const result = decode.apply(this, args);
        const elapsedTime = process.hrtime.bigint() - startTime;
        const elapsedTimeMs = Number(elapsedTime) / 1000 / 1000;

        if (elapsedTimeMs > 1) {
            console.log('AutoEncoder.decode took ' + elapsedTimeMs.toFixed(2) + 'ms');
        }

        const context = ContextInstance.optional;
        if (context) {
            context.timers.set('AutoEncoder.decode', (context.timers.get('AutoEncoder.decode') ?? 0) + elapsedTimeMs);
        }

        return result;
    };

    const encode = AutoEncoder.prototype.encode;
    AutoEncoder.prototype.encode = function (this: AutoEncoder, ...args) {
        const c = args[0] as any;
        if (c._didTrack) {
            return encode.apply(this, args);
        }
        c._didTrack = true;

        const startTime = process.hrtime.bigint();
        const result = encode.apply(this, args);
        const elapsedTime = process.hrtime.bigint() - startTime;
        const elapsedTimeMs = Number(elapsedTime) / 1000 / 1000;

        if (elapsedTimeMs > 1) {
            console.log('AutoEncoder.encode took ' + elapsedTimeMs.toFixed(2) + 'ms');
        }

        const context = ContextInstance.optional;
        if (context) {
            context.timers.set('AutoEncoder.encode', (context.timers.get('AutoEncoder.encode') ?? 0) + elapsedTimeMs);
        }

        return result;
    };

    // Add middleware to log timers
    const LogTimersMiddleware: ResponseMiddleware = {
        handleResponse(request: Request, response: Response, error?: Error) {
            const prefix = !error ? [] : requestPrefix(request, 'error');
            const context = (request as any)._context as ContextInstance | undefined;

            if (context && request.method !== 'OPTIONS') {
                logger.log(
                    ...prefix,
                    ' - Timers: ' + Array.from(context.timers.entries()).sort((a, b) => {
                        return b[1] - a[1];
                    }).map(([key, value]) => `\n- ${key}: ${value.toFixed(2)}ms`).join(''),
                );
            }
        },
    };
    routerServer.addResponseMiddleware(LogTimersMiddleware);
}
