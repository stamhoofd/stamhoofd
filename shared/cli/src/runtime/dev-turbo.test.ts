import { expect, it } from 'vitest';
import { forwardTurboLine } from '@node/dev-tools/turbo';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

it('keeps inspector HTTP discovery and warnings while hiding its normal-mode banner', () => {
    const supervisor = fileURLToPath(import.meta.resolve('@node/dev-tools/supervise'));
    const script = `import inspector from 'node:inspector'; const url = inspector.url(); const response = await fetch(new URL('/json/list', url.replace('ws:', 'http:'))); console.log((await response.json())[0].webSocketDebuggerUrl === url); console.warn('application warning');`;
    for (const verbose of ['0', '1']) {
        const result = spawnSync(process.execPath, [supervisor, 'api', 'node', '--inspect=0', '--input-type=module', '-e', script], {
            env: { ...process.env, STAM_DEV_SESSION: 'test', STAM_DEV_VERBOSE: verbose },
            encoding: 'utf8',
            timeout: 10_000,
        });
        expect(result.status).toBe(0);
        expect(result.stdout).toContain('true');
        expect(result.stderr).toContain('application warning');
        expect(result.stderr.includes('Debugger listening')).toBe(verbose === '1');
    }
});

it('suppresses pnpm script echoes without suppressing child stdout or stderr', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'stam-pnpm-logs-'));
    try {
        await fs.writeFile(path.join(directory, 'package.json'), JSON.stringify({ scripts: { diagnostics: 'node diagnostics.cjs' } }));
        await fs.writeFile(path.join(directory, 'diagnostics.cjs'), 'console.log("useful stdout"); console.warn("useful warning"); console.error("useful error");');
        const result = spawnSync('pnpm', ['--dir', directory, 'run', 'diagnostics'], {
            env: { ...process.env, PNPM_CONFIG_LOGLEVEL: 'warn' },
            encoding: 'utf8',
            timeout: 10_000,
        });
        expect(result.status).toBe(0);
        expect(result.stdout).toContain('useful stdout');
        expect(result.stderr).toContain('useful warning');
        expect(result.stderr).toContain('useful error');
        expect(result.stdout + result.stderr).not.toContain('node diagnostics.cjs');
    } finally {
        await fs.rm(directory, { recursive: true, force: true });
    }
});

it('forwards subprocess streams and failure status with pnpm warning-level reporting', () => {
    const adapter = import.meta.resolve('@node/dev-tools/turbo');
    const childScript = `console.log(JSON.stringify({ source: 'turbo', level: 'info', text: 'hidden progress' })); console.log(JSON.stringify({ source: 'fixture#dev', level: 'stdout', text: 'useful output' })); console.error('raw stderr warning'); process.exitCode = 7;`;
    const script = `import { runTurbo } from ${JSON.stringify(adapter)}; process.exitCode = await runTurbo(['exec', 'node', '-e', ${JSON.stringify(childScript)}, '--']);`;
    for (const verbose of ['0', '1']) {
        const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
            env: { ...process.env, STAM_DEV_SESSION: 'test', STAM_DEV_VERBOSE: verbose, PNPM_CONFIG_LOGLEVEL: 'warn' },
            encoding: 'utf8',
            timeout: 10_000,
        });
        expect(result.status).toBe(7);
        expect(result.stderr).toContain('raw stderr warning');
        expect(result.stdout).toContain('useful output');
        if (verbose === '0') {
            expect(result.stdout).not.toContain('hidden progress');
            expect(result.stdout).toContain('fixture:dev: useful output');
        } else {
            expect(result.stdout).toContain('hidden progress');
        }
    }
});

it('uses structured levels while preserving every task message and Turbo warning/error', () => {
    const output: [string, string][] = [];
    const write = (stream: 'stdout' | 'stderr', text: string) => output.push([stream, text]);
    const record = (source: string, level: string, text: string) => forwardTurboLine(JSON.stringify({ source, level, text }), write);
    record('turbo', 'info', 'routine progress');
    record('@stamhoofd/backend#dev', 'stdout', 'WARN useful diagnostic');
    record('@stamhoofd/backend#dev', 'stderr', '    at boot (boot.ts:10)');
    record('@node/logging#build', 'stdout', 'cache hit, suppressing logs abc');
    record('turbo', 'warn', 'configuration warning');
    record('turbo', 'error', 'task failed');
    expect(output).toEqual([
        ['stdout', '[api] WARN useful diagnostic\n'],
        ['stderr', '[api]     at boot (boot.ts:10)\n'],
        ['stdout', '@node/logging:build: cache hit, suppressing logs abc\n'],
        ['stderr', 'turbo: configuration warning\n'],
        ['stderr', 'turbo: task failed\n'],
    ]);
});

it('buffers successful shared builds, replays failed builds, and always streams verbose builds', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'stam-buffer-test-'));
    const adapter = import.meta.resolve('@node/dev-tools/turbo');
    try {
        for (const [verbose, code] of [['0', 0], ['0', 7], ['1', 0]] as const) {
            const childScript = `console.log(JSON.stringify({ source: 'fixture#build', level: 'stdout', text: 'compiler diagnostic' })); console.error('build warning'); process.exitCode = ${code};`;
            const script = `import { runTurbo } from ${JSON.stringify(adapter)}; process.exitCode = await runTurbo(['exec', 'node', '-e', ${JSON.stringify(childScript)}, '--'], { bufferOutput: true });`;
            const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
                env: { ...process.env, STAM_DEV_SESSION: 'test', STAM_DEV_VERBOSE: verbose, TMPDIR: directory, PNPM_CONFIG_LOGLEVEL: 'warn' },
                encoding: 'utf8',
                timeout: 10_000,
            });
            expect(result.status).toBe(code);
            if (verbose === '0' && code === 0) {
                expect(result.stdout + result.stderr).toBe('');
            } else {
                expect(result.stdout + result.stderr).toContain('compiler diagnostic');
                expect(result.stderr).toContain('build warning');
            }
            expect((await fs.readdir(directory)).filter(name => name.startsWith('stam-shared-log-'))).toEqual([]);
        }
    } finally {
        await fs.rm(directory, { recursive: true, force: true });
    }
});

it('preserves malformed and unknown protocol records instead of silently dropping output', () => {
    const output: string[] = [];
    for (const line of ['unexpected output', 'null', '{"source":"turbo","level":"future","text":"message"}', '{"source":"turbo","level":"info"}']) {
        forwardTurboLine(line, (_stream: string, text: string) => output.push(text));
        expect(output.at(-1)).toBe(line + '\n');
    }
});
