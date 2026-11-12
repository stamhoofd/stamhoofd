import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { shellQuote } from './dev-commands.js';

const wrapper = resolve(
    import.meta.dirname,
    '../../../../packages/node/dev-tools/dist/concurrently.js',
);

function start(source: string | string[], verbose = false) {
    const commands = [source]
        .flat()
        .map((code) => `exec ${shellQuote(process.execPath)} -e ${shellQuote(code)}`);
    const names = commands
        .map((_, index) => (index === 0 ? 'fixture' : `sibling${index}`))
        .join(',');
    const child = spawn(process.execPath, [wrapper, names, ...commands], {
        detached: true,
        env: { ...process.env, FORCE_COLOR: '0', STAM_DEV_VERBOSE: verbose ? '1' : '0' },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    const closed = once(child, 'close');
    return { child, closed, output: () => output, command: commands[0] };
}

it.each([0, 7])('keeps shutdown diagnostics and nonzero exits visible (exit %i)', async (code) => {
    const run = start(
        `process.on('SIGTERM', () => { console.error('shutdown diagnostic'); process.exit(${code}); }); console.log('ready'); setInterval(() => {}, 1000);`,
    );
    try {
        await expect.poll(run.output).toContain('[fixture] ready');
        run.child.kill('SIGTERM');
        await run.closed;
        expect(run.output()).toContain('[fixture] shutdown diagnostic');
        expect(run.output()).not.toContain(run.command);
        expect(run.output()).not.toContain('Sending SIGTERM');
        if (code) expect(run.output()).toContain('exited with code 7');
        else expect(run.output()).not.toContain('exited with code');
    } finally {
        try {
            process.kill(-run.child.pid!, 'SIGKILL');
        } catch {
            /* Already stopped. */
        }
        await run.closed;
    }
});

it('reports unexpected failure concisely and returns failure', async () => {
    const run = start("console.error('actual error'); process.exit(7);");
    expect((await run.closed)[0]).toBe(1);
    expect(run.output()).toContain('[fixture] actual error');
    expect(run.output()).toContain('[fixture] exited with code 7');
    expect(run.output()).not.toContain(run.command);
});

it('retains full orchestration diagnostics in verbose mode', async () => {
    const run = start('process.exit(7);', true);
    await run.closed;
    expect(run.output()).toContain(`${run.command} exited with code 7`);
});

it('silences expected signal exits and repeated kill notices for a process group', async () => {
    const run = start(
        Array.from({ length: 3 }, () => "console.log('ready'); setInterval(() => {}, 1000);"),
    );
    try {
        await expect.poll(() => run.output().match(/ready/g)?.length).toBe(3);
        process.kill(-run.child.pid!, 'SIGTERM');
        await run.closed;
        expect(run.output()).not.toContain('exited with code');
        expect(run.output()).not.toContain('Sending SIGTERM');
    } finally {
        try {
            process.kill(-run.child.pid!, 'SIGKILL');
        } catch {
            /* Already stopped. */
        }
        await run.closed;
    }
});

it('reports unexpected signals and terminates siblings on failure', async () => {
    const run = start([
        "setTimeout(() => process.kill(process.pid, 'SIGTERM'), 200);",
        "process.on('SIGTERM', () => { console.error('sibling stopped'); process.exit(0); }); console.log('ready'); setInterval(() => {}, 1000);",
    ]);
    try {
        expect((await run.closed)[0]).toBe(1);
        expect(run.output()).toContain('[fixture] exited with code SIGTERM');
        expect(run.output()).toContain('[sibling1] sibling stopped');
    } finally {
        try {
            process.kill(-run.child.pid!, 'SIGKILL');
        } catch {
            /* Already stopped. */
        }
        await run.closed;
    }
});
