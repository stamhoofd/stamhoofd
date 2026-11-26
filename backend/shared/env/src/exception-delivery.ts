import { projectExceptionEvent, setExceptionEnvelopeSink } from '@common/errors';
import { NodeClient, Scope, defaultStackParser, makeNodeTransport } from '@sentry/node';
import type { ExceptionArtifacts, ExceptionDeployment } from '@common/errors';
import { eachMapping, TraceMap } from '@jridgewell/trace-mapping';
import { SourceMap } from 'node:module';
import type { SourceMapPayload } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** Index only the executable's published JS, never paths supplied by an exception. */
function buildIndex(): ExceptionArtifacts {
    const root = path.dirname(path.resolve(process.argv[1]));
    if (path.basename(root) !== 'dist' || path.basename(process.argv[1]) !== 'index.js')
        return () => undefined;
    const files = new Map<string, string>();
    const originals = new Map<string, string[]>();
    const cache = new Map<string, ReturnType<ExceptionArtifacts>>();
    // eslint-disable-next-line node-security/no-arbitrary-file-access -- The Node executable's own dist directory, not a frame, URL or request parameter.
    for (const entry of readdirSync(root, { recursive: true, withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
        const file = path.join(entry.parentPath, entry.name);
        files.set(pathToFileURL(file).href, file);
        files.set(file, file);
        // tsc rootDir is either the app or its src directory. These are candidates
        // only: an original position must also occur in the corresponding private map.
        const relative = path.relative(root, file).replace(/\.js$/, '.ts');
        for (const base of [path.dirname(root), path.resolve(root, '../src')]) {
            const original = path.join(base, relative);
            originals.set(original, [...(originals.get(original) ?? []), file]);
        }
    }
    return (url) => {
        if (originals.has(url)) {
            if (!cache.has(url)) {
                const coordinates = new Set<string>();
                for (const file of originals.get(url)!) {
                    try {
                        const map = new TraceMap(
                            readFileSync(file + '.map', 'utf8'),
                            pathToFileURL(file).href,
                        );
                        eachMapping(map, (point) => {
                            if (
                                point.source === pathToFileURL(url).href &&
                                point.originalColumn !== null
                            )
                                coordinates.add(
                                    `${point.originalLine}:${point.originalColumn + 1}`,
                                );
                        });
                    } catch {
                        /* Missing/unreadable map does not establish ownership. */
                    }
                }
                const filename = `app:///${path.relative(path.dirname(root), url)}`;
                cache.set(url, {
                    resolve: (lineno, colno) =>
                        coordinates.has(`${lineno}:${colno}`)
                            ? { filename, lineno, colno }
                            : undefined,
                });
            }
            return cache.get(url);
        }
        const file = files.get(url);
        if (!file) return;
        if (!cache.has(file)) {
            cache.set(file, undefined);
            try {
                const lengths = readFileSync(file, 'utf8')
                    .split('\n')
                    .map((line) => line.length);
                const map = new SourceMap(
                    JSON.parse(readFileSync(file + '.map', 'utf8')) as SourceMapPayload,
                );
                cache.set(file, {
                    resolve(line, col) {
                        if (!(col <= lengths[line - 1])) return;
                        const point = map.findEntry(line - 1, col - 1);
                        if (!('originalSource' in point) || point.generatedLine !== line - 1)
                            return;
                        const relative = path.relative(
                            path.dirname(root),
                            path.resolve(path.dirname(file), point.originalSource),
                        );
                        if (!/^(?:src\/(?:[\w-]+\/)*)?[\w-]+\.ts$/.test(relative)) return;
                        return {
                            filename: `app:///${relative}`,
                            lineno: point.originalLine + 1,
                            colno: point.originalColumn + 1,
                        };
                    },
                });
            } catch {
                // Unmapped dependency or invalid artifact: omit the frame.
            }
        }
        return cache.get(file);
    };
}

export function configureBackendExceptions(service: string) {
    const dsn = process.env.STAM_ERRORS_DSN;
    if (process.env.STAM_ERRORS_ENABLED !== '1' || !dsn) return;
    const deployment = {
        service,
        brand: process.env.STAM_ERRORS_BRAND,
        release: process.env.STAM_ERRORS_RELEASE,
        environment: process.env.STAM_ERRORS_ENVIRONMENT,
    };
    let lookup: ExceptionArtifacts | undefined;
    configureNodeExceptions(deployment, dsn, (file) => (lookup ??= buildIndex())(file));
}

export function configureNodeExceptions(
    deployment: ExceptionDeployment,
    dsn: string,
    lookup: ExceptionArtifacts,
) {
    // A standalone client leaves our OpenTelemetry provider and process handlers untouched.
    const client = new NodeClient({
        dsn,
        ...deployment,
        integrations: [],
        sendClientReports: false,
        transport: makeNodeTransport,
        stackParser: defaultStackParser,
        beforeSend(event, hint) {
            const boundary: unknown = hint.data?.boundary;
            if (
                boundary !== 'backend.startup' &&
                boundary !== 'backend.rejection' &&
                boundary !== 'backend.request'
            )
                return null;
            return projectExceptionEvent(
                event,
                hint.originalException,
                boundary,
                deployment,
                lookup,
            );
        },
    });
    if (!client.getDsn()) return;
    const scope = new Scope();
    scope.setClient(client);
    setExceptionEnvelopeSink(async ({ boundary }, error) => {
        scope.captureException(error, { data: { boundary } });
        await client.flush(1000);
    });
}
