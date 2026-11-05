import { runTurbo } from './turbo.js';
import fs from 'node:fs/promises';
import { createDevEmitter } from './events.js';

const emitter = createDevEmitter('shared');
const cycleId = process.hrtime.bigint().toString();
const marker = process.argv[2];
if (!/^\.development\/cli\/generated\/shared-build-\d+\.ready$/.test(marker ?? '')) throw new Error('Expected the session shared-build ready marker');
emitter.emit('build.started', { cycleId });
const args = ['run', 'build:shared', ...(process.argv.includes('--verbose') ? [] : ['--output-logs=new-only'])];
let cancelled = false;
for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => { cancelled = true; });
}
const code = await runTurbo(args, { bufferOutput: true });
if (!cancelled) {
    emitter.emit(code === 0 ? 'build.succeeded' : 'build.failed', { cycleId });
    if (code === 0) {
        await fs.mkdir('.development/cli/generated', { recursive: true });
        // eslint-disable-next-line node-security/no-arbitrary-file-access -- CLI-owned marker validated against the fixed directory and filename above.
        await fs.writeFile(marker, '');
    }
}
await emitter.close();
// Nodemon must keep watching after a compiler failure, as it did with `|| exit 0`.
process.exitCode = 0;
