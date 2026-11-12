import { withLogSink } from '@common/opentelemetry-decorators';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContainerRuntime, getContainerRuntime } from '../services/docker.js';
import { publishDocsImage } from './docs-image.js';
import { withCliTelemetry } from './telemetry.js';
import { RunVerbosity } from './verbosity.js';

vi.mock('../services/docker.js', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../services/docker.js')>()),
    getContainerRuntime: vi.fn(),
}));

const credentials = { username: 'test-publisher', password: 'test-secret-password' };
const encoded = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');
const registry = 'registry.example.com:5000/team';
type Call = {
    args: string[];
    authFile: string;
    config: unknown;
    directoryMode: number;
    fileMode: number;
    input: string;
    daemonHost: string;
};

describe.each([ContainerRuntime.Podman, ContainerRuntime.Docker])(
    'isolated %s docs publishing',
    (runtime) => {
        let root: string;
        let originalConfig: string;

        beforeEach(async () => {
            root = await fs.mkdtemp(path.join(os.tmpdir(), 'stam-docs-auth-test-'));
            originalConfig = path.join(root, 'original-config');
            await fs.mkdir(originalConfig);
            await fs.mkdir(path.join(originalConfig, 'contexts/meta/example'), { recursive: true });
            await fs.mkdir(path.join(originalConfig, 'contexts/tls/example/docker'), {
                recursive: true,
            });
            await fs.writeFile(
                path.join(originalConfig, 'contexts/meta/example/meta.json'),
                '{"Name":"selected-context","Endpoints":{"docker":{"Host":"tcp://selected.example.com:2376"}}}',
            );
            await fs.writeFile(
                path.join(originalConfig, 'contexts/tls/example/docker/key.pem'),
                'context-tls-private-key',
            );
            await fs.writeFile(
                path.join(originalConfig, 'config.json'),
                '{"currentContext":"selected-context","credsStore":"original-helper","auths":{"existing.example.com":{"auth":"original"}}}',
            );
            await fs.writeFile(
                path.join(root, 'original-auth.json'),
                '{"auths":{"existing.example.com":{"auth":"original"}}}',
            );
            vi.stubEnv('DOCKER_CONFIG', originalConfig);
            vi.stubEnv('DOCKER_CONTEXT', 'selected-context');
            vi.stubEnv('DOCKER_HOST', '');
            vi.stubEnv('REGISTRY_AUTH_FILE', path.join(root, 'original-auth.json'));
            vi.stubEnv('DOCKER_AUTH_CONFIG', 'ambient-auth');
            vi.stubEnv('STAM_DOCS_REGISTRY_USERNAME', credentials.username);
            vi.stubEnv('STAM_DOCS_REGISTRY_PASSWORD', credentials.password);
            vi.stubEnv('STAM_AUTH_TEST_ROOT', root);
            vi.stubEnv('STAM_AUTH_TEST_OUTCOME', 'success');
            vi.stubEnv('PATH', `${root}${path.delimiter}${process.env.PATH}`);
            vi.mocked(getContainerRuntime).mockResolvedValue(runtime);
            await fs.writeFile(
                path.join(root, runtime),
                String.raw`#!${process.execPath}
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
if (args[0] === 'context' && args[1] === 'inspect') {
    const original = JSON.parse(fs.readFileSync(path.join(process.env.DOCKER_CONFIG, 'config.json'), 'utf8'));
    const selected = process.env.DOCKER_HOST ? 'default' : process.env.DOCKER_CONTEXT || original.currentContext;
    process.stdout.write(JSON.stringify([{ Name: selected, TLSMaterial: selected === 'default' ? {} : { docker: ['key.pem'] }, Storage: {
        MetadataPath: selected === 'default' ? '<IN MEMORY>' : path.join(process.env.DOCKER_CONFIG, 'contexts/meta/example'),
        TLSPath: selected === 'default' ? '<IN MEMORY>' : path.join(process.env.DOCKER_CONFIG, 'contexts/tls/example'),
    } }]));
    process.exit(0);
}
const command = args[0] === '--config' ? args[2] : args[0];
const authFile = process.env.REGISTRY_AUTH_FILE;
const config = JSON.parse(fs.readFileSync(authFile, 'utf8'));
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
    let daemonHost = '';
    if (path.basename(process.argv[1]) === 'docker') {
        const selected = process.env.DOCKER_HOST ? 'default' : process.env.DOCKER_CONTEXT || 'selected-context';
        if (config.currentContext !== selected) throw new Error('selected Docker context was lost');
        if (selected !== 'default') {
            if (fs.readFileSync(path.join(process.env.DOCKER_CONFIG, 'contexts/tls/example/docker/key.pem'), 'utf8') !== 'context-tls-private-key') throw new Error('context TLS material was lost');
            const metadata = JSON.parse(fs.readFileSync(path.join(process.env.DOCKER_CONFIG, 'contexts/meta/example/meta.json'), 'utf8'));
            daemonHost = metadata.Endpoints.docker.Host;
        } else {
            daemonHost = process.env.DOCKER_HOST || 'unix:///var/run/docker.sock';
        }
    }
    if (process.env.DOCKER_AUTH_CONFIG || process.env.STAM_DOCS_REGISTRY_PASSWORD || process.env.STAM_DOCS_REGISTRY_USERNAME) process.exit(3);
    fs.appendFileSync(path.join(process.env.STAM_AUTH_TEST_ROOT, 'calls.jsonl'), JSON.stringify({ args, authFile, config, input, daemonHost, directoryMode: fs.statSync(path.dirname(authFile)).mode & 511, fileMode: fs.statSync(authFile).mode & 511 }) + '\n');
    if (command === 'login') {
        const username = args[args.indexOf('--username') + 1];
        const password = input.trimEnd();
        config.auths[args.at(-1)] = { auth: Buffer.from(username + ':' + password).toString('base64') };
        fs.writeFileSync(authFile, JSON.stringify(config));
        process.stdout.write(password.slice(0, 7));
        process.stdout.write(password.slice(7));
        process.stderr.write(password);
    } else {
        process.stdout.write(JSON.stringify(config));
        process.stderr.write(JSON.stringify(config));
    }
    if (process.env.STAM_AUTH_TEST_OUTCOME === command) process.exitCode = 1;
    if (process.env.STAM_AUTH_TEST_OUTCOME === 'latest-push' && command === 'push' && args.at(-1).endsWith(':latest')) process.exitCode = 1;
    if (command === 'push' && process.env.STAM_AUTH_TEST_OUTCOME === 'cancel') {
        process.stdout.write('ready-to-cancel' + '.'.repeat(300));
        setInterval(() => {}, 1000);
    }
});
`,
                { mode: 0o700 },
            );
        });

        afterEach(async () => {
            vi.unstubAllEnvs();
            vi.clearAllMocks();
            await fs.rm(root, { recursive: true, force: true });
        });

        if (runtime === ContainerRuntime.Docker) {
            // Docker's resolveContextName checks DOCKER_HOST before DOCKER_CONTEXT,
            // despite the CLI web docs: https://github.com/docker/cli/blob/v29.9.3/cli/command/cli.go#L459-L480
            it.each([
                {
                    name: 'saved context without environment overrides',
                    context: '',
                    host: '',
                    expectedContext: 'selected-context',
                    expectedHost: 'tcp://selected.example.com:2376',
                },
                {
                    name: 'DOCKER_HOST overriding the saved context',
                    context: '',
                    host: 'tcp://environment.example.com:2376',
                    expectedContext: 'default',
                    expectedHost: 'tcp://environment.example.com:2376',
                },
                {
                    name: 'DOCKER_CONTEXT without a host override',
                    context: 'selected-context',
                    host: '',
                    expectedContext: 'selected-context',
                    expectedHost: 'tcp://selected.example.com:2376',
                },
                {
                    name: 'DOCKER_HOST precedence when both overrides are set',
                    context: 'selected-context',
                    host: 'tcp://environment.example.com:2376',
                    expectedContext: 'default',
                    expectedHost: 'tcp://environment.example.com:2376',
                },
            ])(
                'preserves $name for login, tag and push',
                async ({ context, host, expectedContext, expectedHost }) => {
                    vi.stubEnv('DOCKER_CONTEXT', context);
                    vi.stubEnv('DOCKER_HOST', host);
                    await withLogSink(
                        () => false,
                        () => publishDocsImage(root, 'v1.2.3', { registry, credentials }),
                    );
                    const calls = (await fs.readFile(path.join(root, 'calls.jsonl'), 'utf8'))
                        .trim()
                        .split('\n')
                        .map((line) => JSON.parse(line) as Call);
                    expect(calls).toHaveLength(3);
                    for (const call of calls) {
                        expect(call.config).toMatchObject({ currentContext: expectedContext });
                        expect(call.daemonHost).toBe(expectedHost);
                    }
                    await expect(fs.stat(path.dirname(calls[0].authFile))).rejects.toMatchObject({
                        code: 'ENOENT',
                    });
                },
            );
        }

        it.each([
            ...[false, true].flatMap((latest) =>
                ['success', 'login', 'tag', 'push', 'cancel'].map((outcome) => ({
                    latest,
                    outcome,
                })),
            ),
            { latest: true, outcome: 'latest-push' },
        ])(
            'isolates auth and removes it after $outcome (latest=$latest), redacting subprocess diagnostics',
            async ({ outcome, latest }) => {
                vi.stubEnv('STAM_AUTH_TEST_OUTCOME', outcome);
                const originalDocker = await fs.readFile(
                    path.join(originalConfig, 'config.json'),
                    'utf8',
                );
                const originalPodman = await fs.readFile(
                    path.join(root, 'original-auth.json'),
                    'utf8',
                );
                const diagnostics: string[] = [];
                let cancelled = false;
                let failure: unknown;
                await withCliTelemetry('docs.auth.test', RunVerbosity.Quiet, () =>
                    withLogSink(
                        (_level, message, fields) => {
                            diagnostics.push(JSON.stringify({ message, fields }));
                            if (
                                outcome === 'cancel' &&
                                message.includes('ready-to-cancel') &&
                                !cancelled
                            ) {
                                cancelled = true;
                                process.emit('SIGINT');
                            }
                            return false;
                        },
                        async () => {
                            try {
                                await publishDocsImage(
                                    root,
                                    'v1.2.3',
                                    { registry, credentials },
                                    RunVerbosity.Output,
                                    latest,
                                );
                            } catch (error) {
                                failure = error;
                            }
                        },
                    ),
                );
                if (outcome === 'success') expect(failure).toBeUndefined();
                else expect(failure).toBeInstanceOf(Error);
                if (outcome === 'cancel') {
                    expect(cancelled).toBe(true);
                    expect(String(failure)).toContain('130');
                }
                const calls = (await fs.readFile(path.join(root, 'calls.jsonl'), 'utf8'))
                    .trim()
                    .split('\n')
                    .map((line) => JSON.parse(line) as Call);
                expect(calls).toHaveLength(
                    outcome === 'login'
                        ? 1
                        : outcome === 'tag'
                          ? 2
                          : (outcome === 'success' || outcome === 'latest-push') && latest
                            ? 5
                            : 3,
                );
                expect(calls[0].config).toEqual({
                    auths: { 'registry.example.com:5000': {} },
                    ...(runtime === ContainerRuntime.Docker
                        ? { currentContext: 'selected-context' }
                        : {}),
                });
                expect(calls[0].input).toBe(`${credentials.password}\n`);
                const authFile = calls[0].authFile;
                const prefix =
                    runtime === ContainerRuntime.Docker ? ['--config', path.dirname(authFile)] : [];
                const auth = runtime === ContainerRuntime.Podman ? ['--authfile', authFile] : [];
                expect(calls[0].args).toEqual([
                    ...prefix,
                    'login',
                    ...auth,
                    '--username',
                    credentials.username,
                    '--password-stdin',
                    'registry.example.com:5000',
                ]);
                if (calls[1])
                    expect(calls[1].args).toEqual([
                        ...prefix,
                        'tag',
                        'docs:v1.2.3',
                        `${registry}/docs:v1.2.3`,
                    ]);
                if (calls[2])
                    expect(calls[2].args).toEqual([
                        ...prefix,
                        'push',
                        ...auth,
                        `${registry}/docs:v1.2.3`,
                    ]);
                if (calls[3])
                    expect(calls[3].args).toEqual([
                        ...prefix,
                        'tag',
                        'docs:v1.2.3',
                        `${registry}/docs:latest`,
                    ]);
                if (calls[4])
                    expect(calls[4].args).toEqual([
                        ...prefix,
                        'push',
                        ...auth,
                        `${registry}/docs:latest`,
                    ]);
                for (const call of calls) {
                    expect(call.authFile).toBe(authFile);
                    expect(call.directoryMode).toBe(0o700);
                    expect(call.fileMode).toBe(0o600);
                    expect(call.args).not.toContain('logout');
                    expect(call.args.join(' ')).not.toContain(credentials.password);
                }
                await expect(fs.stat(path.dirname(authFile))).rejects.toMatchObject({
                    code: 'ENOENT',
                });
                expect(await fs.readFile(path.join(originalConfig, 'config.json'), 'utf8')).toBe(
                    originalDocker,
                );
                expect(await fs.readFile(path.join(root, 'original-auth.json'), 'utf8')).toBe(
                    originalPodman,
                );
                expect(
                    await fs.readFile(
                        path.join(originalConfig, 'contexts/tls/example/docker/key.pem'),
                        'utf8',
                    ),
                ).toBe('context-tls-private-key');
                const visible = diagnostics.join('\n') + String(failure);
                expect(diagnostics.join('\n')).toContain('[redacted]');
                for (const secret of [credentials.username, credentials.password, encoded])
                    expect(visible).not.toContain(secret);
                expect(getContainerRuntime).toHaveBeenCalledTimes(1);
            },
        );

        it.each([false, true])(
            'uses one login and one push for a requested latest tag (latest=%s)',
            async (latest) => {
                await withLogSink(
                    () => false,
                    () =>
                        publishDocsImage(
                            root,
                            'latest',
                            { registry, credentials },
                            RunVerbosity.Output,
                            latest,
                        ),
                );
                const calls = (await fs.readFile(path.join(root, 'calls.jsonl'), 'utf8'))
                    .trim()
                    .split('\n')
                    .map((line) => JSON.parse(line) as Call);
                expect(calls).toHaveLength(3);
                expect(calls[1].args.slice(-2)).toEqual(['docs:latest', `${registry}/docs:latest`]);
                expect(calls[2].args.at(-1)).toBe(`${registry}/docs:latest`);
                expect(new Set(calls.map((call) => call.authFile)).size).toBe(1);
                await expect(fs.stat(path.dirname(calls[0].authFile))).rejects.toMatchObject({
                    code: 'ENOENT',
                });
                expect(getContainerRuntime).toHaveBeenCalledTimes(1);
            },
        );
    },
);
