import { StdSync } from '@stamhoofd/stdsync';
import { getCliTelemetry } from './telemetry.js';

/** Legacy live views get their own region, never another owner of the invocation's streams. */
export function createTerminalOutput(
    options: { stdout?: NodeJS.WriteStream; stderr?: NodeJS.WriteStream } = {},
) {
    const runtime = getCliTelemetry();
    if (!runtime || options.stdout || options.stderr) return new StdSync(options);
    const region = runtime.terminal.createRegion();
    let content = '';
    return {
        isTTY: runtime.terminal.isTTY,
        setLive(value: string) {
            content = value;
            region.update(value);
        },
        clearLive() {
            content = '';
            region.update('');
        },
        done() {
            region.finish(content);
            content = '';
        },
        // Live views and their subprocess logs are diagnostics, regardless of child stream.
        write(chunk: string | Uint8Array) {
            return runtime.terminal.write(chunk);
        },
    };
}
