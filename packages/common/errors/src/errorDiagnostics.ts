const diagnosticCodes = new Set([
    'EACCES',
    'EADDRINUSE',
    'EAUTH',
    'ECONNREFUSED',
    'ECONNRESET',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'ENOENT',
    'ENOTFOUND',
    'EPIPE',
    'ESOCKET',
    'ETIMEDOUT',
    'EAI_AGAIN',
    'ER_ACCESS_DENIED_ERROR',
    'ER_BAD_FIELD_ERROR',
    'ER_DUP_ENTRY',
    'ER_LOCK_DEADLOCK',
    'ER_LOCK_WAIT_TIMEOUT',
    'ER_NO_SUCH_TABLE',
    'ER_PARSE_ERROR',
    'PROTOCOL_CONNECTION_LOST',
    'ERR_BAD_REQUEST',
    'ERR_BAD_RESPONSE',
    'ERR_NETWORK',
    'rate_limit',
    'resource_missing',
]);

/** Local diagnostic fields only: messages, causes and SDK response objects can contain private data. */
export function errorDiagnostics(error: unknown) {
    try {
        if (error instanceof Error) {
            const code = 'code' in error ? error.code : undefined;
            const status =
                'statusCode' in error
                    ? error.statusCode
                    : 'status' in error
                      ? error.status
                      : undefined;
            // A multiline error message can itself contain lines that look like stack frames.
            const header = Error.prototype.toString.call(error) + '\n';
            const stack = error.stack?.startsWith(header) ? error.stack.slice(header.length) : '';
            const sourceLocation =
                /^ +at .*?\/((?:backend|packages|shared)\/[\w./-]+:\d+:\d+)\)?$/gm;
            const type: unknown = Object.getPrototypeOf(error)?.constructor?.name;
            return {
                errorType: typeof type === 'string' ? type.slice(0, 80) : 'Error',
                code: typeof code === 'string' && diagnosticCodes.has(code) ? code : undefined,
                status:
                    typeof status === 'number' &&
                    Number.isInteger(status) &&
                    status >= 100 &&
                    status <= 599
                        ? status
                        : undefined,
                frames: Array.from(stack.matchAll(sourceLocation), (match) => match[1]),
            };
        }
    } catch {
        // A thrown object may implement throwing accessors. Preserve the original failure path.
    }
    return { errorType: 'unknown' };
}
