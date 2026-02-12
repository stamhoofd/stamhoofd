import { Response, Request, RequestMiddleware, ResponseMiddleware } from '@simonbackx/simple-endpoints';
import { isSimpleError, isSimpleErrors } from '@simonbackx/simple-errors';
import { logger, StyledText } from '@simonbackx/simple-logging';
let requestCounter = 0;

function removePII(object: unknown) {
    if (object === null || object === undefined) {
        return;
    }

    if (typeof object === 'object') {
        // Loop all keys
        for (const key of Object.keys(object)) {
            removePII(object[key]);
            if (key === 'password' || key === 'clientSecret') {
                object[key] = '*******';
            }
        }
        return;
    }

    // Loop array
    if (Array.isArray(object)) {
        for (const item of object) {
            removePII(item);
        }
        return;
    }
}

function logRequestDetails(request: Request) {
    if (Object.keys(request.query).length) {
        const json: any = { ...request.query };
        if (json && json.password) {
            json.password = '*******';
        }

        if (json && json.clientSecret) {
            json.clientSecret = '*******';
        }
        logger.error(
            ...requestPrefix(request, 'query'),
            'Request query was ',
            json,
        );
    }

    request.body.then((body) => {
        if (!body) {
            return;
        }
        try {
            const json = JSON.parse(body);
            if (Array.isArray(json) || Object.keys(json).length) {
                removePII(json);

                logger.error(
                    ...requestPrefix(request, 'body'),
                    'Request body was ',
                    json,
                );
            }
        }
        catch (e) {
            if (typeof body === 'string') {
                logger.error(
                    ...requestPrefix(request, 'body'),
                    'Request body was invalid JSON ',
                    body,
                );
            }
            else {
                // Don't log
                logger.error(
                    ...requestPrefix(request, 'body'),
                    'Request body was of type ' + typeof body,
                    body,
                );
            }
        }
    }).catch(console.error);
}

function requestOneLiner(request: Request): (StyledText | string)[] {
    return [
        new StyledText(request.method).addClass('request', 'method', request.method.toLowerCase()),
        ' ',
        new StyledText(request.url).addClass('request', 'url'),
        ' (',
        new StyledText(request.getIP()).addClass('request', 'ip'),
        '@',
        new StyledText(request.host).addClass('request', 'host'),
        ')',
    ];
}

export function requestPrefix(request: Request, ...classes: string[]): (StyledText | string)[] {
    if ((request as any)._uniqueIndex === undefined) {
        return [
            new StyledText(`[UNKNOWN REQUEST] `).addClass('request', 'tag', ...classes),
        ];
    }
    return [
        new StyledText(`[R${((request as any)._uniqueIndex as number).toString().padStart(4, '0')}] `).addClass('request', 'tag', ...classes),
    ];
}

function assignIndex(request: Request) {
    if ((request as any)._uniqueIndex !== undefined) {
        return; // Already assigned
    }
    (request as any)._uniqueIndex = ++requestCounter;
    (request as any)._startTime = process.hrtime();
}

export const LogMiddleware: ResponseMiddleware & RequestMiddleware = {
    handleRequest(request: Request) {
        assignIndex(request);
    },

    wrapRun<T>(run: () => Promise<T>, request: Request) {
        assignIndex(request);

        if (request.method !== 'OPTIONS' || STAMHOOFD.environment === 'development') {
            logger.log(
                ...requestPrefix(request, 'first'),
                ...requestOneLiner(request),
            );
        }

        return logger.setContext({
            prefixes: requestPrefix(request, 'output'),
            tags: ['request', 'request-output'],
        }, run);
    },

    handleResponse(request: Request, response: Response, error?: Error) {
        const endTime = process.hrtime();
        const startTime = (request as any)._startTime ?? endTime;
        const timeInMs = Math.round((endTime[0] - startTime[0]) * 1000 + (endTime[1] - startTime[1]) / 1000000);

        const prefix = !error ? [] : requestPrefix(request, 'error');

        if (request.method !== 'OPTIONS') {
            logger.log(
                ...prefix,
                new StyledText('HTTP ' + response.status).addClass('request', 'status-code'),
                ' - Finished in ' + timeInMs + 'ms',
            );
        }

        if (error) {
            if (isSimpleError(error) || isSimpleErrors(error)) {
                if (!error.hasCode('expired_access_token') && !error.hasCode('unknown_domain') && !error.hasCode('unknown_webshop')) {
                    logger.error(
                        ...prefix,
                        'Request with error in response:',
                    );
                    logger.error(
                        new StyledText(error).addClass('request', 'error'),
                    );

                    if (!error.hasCode('too_big_attachments')) {
                        logRequestDetails(request);
                    }
                }
            }
            else {
                logger.error(
                    ...prefix,
                    'Request with internal error:',
                );

                logger.error(
                    ...prefix,
                    new StyledText(error).addClass('request', 'error'),
                );

                logRequestDetails(request);
            }
        }
    },
};
