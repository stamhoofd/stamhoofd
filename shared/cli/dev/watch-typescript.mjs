import ts from 'typescript';
import { pathToFileURL } from 'node:url';
import { createDevEmitter } from './events.mjs';

/**
 * Watches one runtime solution through TypeScript's supported builder API.
 * @param {import('./events.mjs').DevApp} app - Development owner for lifecycle events.
 * @param {string} config - Runtime tsconfig path, relative to the package cwd.
 * @returns {{ close(): Promise<void> }} Watcher owner; close stops file watchers and drains events.
 * @remarks Compiler diagnostics remain on stdout. Numeric status diagnostics are
 * compiler API notifications, not parsed terminal text. Turbo still orders packages.
 */
export function watchTypeScript(app, config = 'tsconfig.build.json') {
    const emitter = createDevEmitter(app);
    let cycleId;
    let errors = 0;
    const report = ts.createDiagnosticReporter(ts.sys, true);
    const status = ts.createWatchStatusReporter(ts.sys, true);
    const host = ts.createSolutionBuilderWithWatchHost(ts.sys, undefined, (diagnostic) => {
        if (diagnostic.category === ts.DiagnosticCategory.Error) errors++;
        report(diagnostic);
    }, report, (diagnostic, newline, options) => {
        // TypeScript's public diagnostic codes for initial/incremental watch starts.
        if (diagnostic.code === 6031 || diagnostic.code === 6032) {
            cycleId = process.hrtime.bigint().toString();
            errors = 0;
            emitter.emit('build.started', { cycleId });
        }
        status(diagnostic, newline, { ...options, preserveWatchOutput: true });
        // Watch summary: singular/plural errors. Diagnostics were reported above.
        if (cycleId && (diagnostic.code === 6193 || diagnostic.code === 6194)) {
            emitter.emit(errors ? 'build.failed' : 'build.succeeded', { cycleId, errors });
            cycleId = undefined;
        }
    });
    const builder = ts.createSolutionBuilderWithWatch(host, [config], { watch: true, preserveWatchOutput: true });
    builder.build();
    return {
        async close() {
            builder.close();
            await emitter.close();
        },
    };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const watcher = watchTypeScript(process.argv[2]);
    for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => { void watcher.close(); });
}
