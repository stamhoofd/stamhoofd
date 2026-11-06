import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { DevApp } from './events.js';
import { createDevEmitter } from './events.js';

const [app, command, ...args] = process.argv.slice(2);
if (!app || !command) throw new Error('Expected app and command to supervise');
if (command === 'node' || command === process.execPath) {
    const inspectorPort = process.env[`STAM_DEV_${app.toUpperCase()}_INSPECT_PORT`];
    if (inspectorPort) args.unshift(`--inspect=127.0.0.1:${inspectorPort}`);
    if (process.env.STAM_DEV_SESSION && process.env.STAM_DEV_VERBOSE !== '1') {
        args.unshift('--inspect-publish-uid=http');
    }
}
const env = { ...process.env, STAM_DEV_PROCESS_ID: randomUUID(), STAM_DEV_GENERATION: process.hrtime.bigint().toString() };
if (process.env.STAM_DEV_SOCKET) {
    Object.assign(env, {
        STAM_DEV_APP: app,
        NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${new URL('./application.js', import.meta.url).href}`,
    });
}
const emitter = createDevEmitter(app as DevApp, env);
emitter.emit('starting', ['api', 'renderer', 'stats', 'docs'].includes(app) ? { startupOwner: 'application' } : {});
const child = spawn(command, args, { env, stdio: 'inherit' });
let cancelled = false;
let deadline: NodeJS.Timeout | undefined;
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
        cancelled = true;
        child.kill(signal);
        deadline ??= setTimeout(() => child.kill('SIGKILL'), 2000);
        deadline.unref();
    });
}
const code = await new Promise<number>((resolve) => {
    child.once('error', (error) => { console.error(error); resolve(1); });
    child.once('close', code => resolve(code ?? 1));
});
if (deadline) clearTimeout(deadline);
emitter.emit('stopped', { failed: !cancelled && code !== 0 });
await emitter.close();
process.exitCode = cancelled ? 0 : code;
