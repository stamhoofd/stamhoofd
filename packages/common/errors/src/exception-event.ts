import type { ErrorEvent, StackFrame } from '@sentry/core';
import type { ExceptionBoundary } from './exception-envelope.js';
import { unexpectedExceptionType } from './exception-envelope.js';

export type ExceptionDeployment = {
    dsn?: string;
    browserOrigin?: string;
    environment?: string;
    release?: string;
    brand?: string;
    service?: string;
};
type Position = { filename: string; lineno: number; colno: number };
export type ExceptionArtifacts = (
    file: string,
) =>
    | { id: string; lengths: number[] }
    | { resolve(line: number, column: number): Position | undefined }
    | undefined;

/** Build the outbound event from deployment metadata and SDK-parsed, application-owned frames. */
export function projectExceptionEvent(
    event: ErrorEvent,
    error: unknown,
    boundary: ExceptionBoundary,
    deployment: ExceptionDeployment,
    lookup: ExceptionArtifacts,
): ErrorEvent | null {
    const type = unexpectedExceptionType(error);
    if (!type) return null;
    const frames: StackFrame[] = [];
    const bundles = new Map<string, string>();
    // Sentry orders frames oldest first; retain the eight closest application frames.
    for (const frame of (event.exception?.values?.[0]?.stacktrace?.frames ?? [])
        .slice()
        .reverse()) {
        const { filename, lineno, colno } = frame;
        if (!filename || !lineno || !colno) continue;
        const artifact = lookup(filename);
        if (!artifact) continue;
        if ('resolve' in artifact) {
            const position = artifact.resolve(lineno, colno);
            if (!position) continue;
            frames.unshift({ ...position, in_app: true });
        } else {
            if (!(colno <= artifact.lengths[lineno - 1])) continue;
            const file = `app:///${artifact.id}.js`;
            bundles.set(file, artifact.id);
            frames.unshift({ filename: file, lineno, colno, in_app: true });
        }
        if (frames.length === 8) break;
    }
    const site = frames.at(-1);
    if (!site && boundary === 'browser.global') return null;
    const { brand, environment, release, service } = deployment;
    return {
        type: undefined,
        event_id: event.event_id,
        platform: 'javascript',
        level: 'error',
        release,
        environment,
        tags: { boundary, brand, service },
        fingerprint: [
            environment,
            brand,
            release,
            service,
            boundary,
            type,
            ...(site ? [site.filename, `${site.lineno}:${site.colno}`] : []),
        ].filter((part): part is string => typeof part === 'string'),
        exception: {
            values: [
                { type, value: 'Unexpected exception', stacktrace: site ? { frames } : undefined },
            ],
        },
        debug_meta: bundles.size
            ? {
                  images: Array.from(bundles, ([code_file, debug_id]) => ({
                      type: 'sourcemap',
                      code_file,
                      debug_id,
                  })),
              }
            : undefined,
    };
}
