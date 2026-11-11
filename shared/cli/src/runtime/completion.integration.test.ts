import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TestContext } from 'vitest';
import { getProjectPath } from '../context/project-path.js';

const execute = promisify(execFile);
const realCli = path.join(getProjectPath(), 'shared/cli');

async function requireShell(shell: string, context: TestContext): Promise<void> {
    if (shell !== 'zsh') return;
    try { await execute(shell, ['--version']); }
    catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') context.skip('Zsh executable is not installed; Bash and core completion tests still run.');
        throw error;
    }
}

describe('generated oclif completion with live local environments', () => {
    let root: string;
    let env: NodeJS.ProcessEnv;
    let modulePath: string;

    beforeEach(async () => {
        root = await fs.mkdtemp(path.join(os.tmpdir(), 'stam-completion-test-'));
        const cli = path.join(root, 'shared/cli');
        await fs.mkdir(cli, { recursive: true });
        for (const entry of ['dist', 'bin', 'package.json']) await fs.cp(path.join(realCli, entry), path.join(cli, entry), { recursive: true });
        await fs.symlink(path.join(realCli, 'node_modules'), path.join(cli, 'node_modules'));
        await fs.mkdir(path.join(root, 'devops/dist-cli'), { recursive: true });
        await fs.writeFile(path.join(root, 'devops/package.json'), '{"name":"devops","type":"module"}');
        modulePath = path.join(root, 'devops/dist-cli/docs-publishing.js');
        await fs.writeFile(modulePath, `export const docsPublishingProvider = {
            listEnvironments: async () => [{ value: 'example-blue', name: 'Example blue' }, { value: 'example-green', name: 'Example green' }],
            resolve: async () => { throw new Error('Completion must not resolve credentials or infrastructure'); },
        };`);
        await fs.mkdir(path.join(root, 'executables'));
        await fs.writeFile(path.join(root, 'executables/stam'), `#!/usr/bin/env bash\nexec '${process.execPath}' '${cli}/bin/stam.js' "$@"\n`, { mode: 0o700 });
        env = { ...process.env, PATH: `${root}/executables:${process.env.PATH}`, XDG_CACHE_HOME: path.join(root, 'cache'), XDG_CONFIG_HOME: path.join(root, 'config') };
    });

    afterEach(async () => {
        await fs.rm(root, { recursive: true, force: true });
    });

    it.each(['bash', 'zsh'])('generates and requests %s completion from a nested working directory', async (shell, context) => {
        await requireShell(shell, context);
        const { stdout: activation } = await execute('stam', ['completion', shell], { cwd: path.join(root, 'shared/cli'), env });
        const activationPath = path.join(root, 'activation');
        await fs.writeFile(activationPath, activation);
        const request = shell === 'bash' ? `
            COMP_WORDS=(stam docs image publish v1.2.3 --environment example-b)
            COMP_CWORD=6
            _stam_local_completion
            printf '%s\\n' "\${COMPREPLY[@]}"
        ` : `
            compadd() { shift; print -l -- "$@"; }
            words=(stam docs image publish v1.2.3 --environment example-b)
            CURRENT=7
            _stam_local_completion
        `;
        const requestPath = path.join(root, 'request');
        await fs.writeFile(requestPath, `source '${activationPath}'\n${request}`);
        const complete = () => execute(shell, [requestPath], { cwd: path.join(root, 'shared/cli'), env });
        expect((await complete()).stdout.trim()).toBe('example-blue');
        await fs.writeFile(modulePath, `export const docsPublishingProvider = {
            listEnvironments: async () => [{ value: 'example-bronze', name: 'New local environment' }],
            resolve: async () => { throw new Error('must not resolve'); },
        };`);
        expect((await complete()).stdout.trim()).toBe('example-bronze');
        for (const entry of await fs.readdir(path.join(root, 'cache'), { recursive: true, withFileTypes: true })) {
            if (!entry.isFile()) continue;
            const text = await fs.readFile(path.join(entry.parentPath, entry.name), 'utf8');
            expect(text).not.toContain('example-blue');
            expect(text).not.toContain('example-bronze');
        }
        expect((await fs.stat(path.join(root, 'cache/@stamhoofd/cli'))).mode & 0o777).toBe(0o700);
        await fs.rm(modulePath);
        expect((await complete()).stdout.trim()).toBe('');
    }, 30_000);

    it.each(['bash', 'zsh'])('completes equals-form environment values in %s', async (shell, context) => {
        await requireShell(shell, context);
        const { stdout: activation } = await execute('stam', ['completion', shell], { env });
        const requests = shell === 'bash' ? [
            { words: 'stam docs image publish v1.2.3 --environment = example-b', current: 7, expected: 'example-blue' },
            { words: 'stam docs image publish v1.2.3 --environment = ""', current: 7, expected: 'example-blue\nexample-green' },
            { words: 'stam docs image publish v1.2.3 --environment =', current: 6, expected: 'example-blue\nexample-green' },
            { words: 'stam docs image publish v1.2.3 --environment=example-b', current: 5, expected: '--environment=example-blue' },
        ] : [
            { words: 'stam docs image publish v1.2.3 --environment=example-b', current: 6, expected: '--environment=example-blue' },
            { words: 'stam docs image publish v1.2.3 --environment=', current: 6, expected: '--environment=example-blue\n--environment=example-green' },
        ];
        for (const request of requests) {
            const script = shell === 'bash' ? `
                COMP_WORDS=(${request.words})
                COMP_CWORD=${request.current}
                _stam_local_completion
                printf '%s\\n' "\${COMPREPLY[@]}"
            ` : `
                compadd() { shift; print -l -- "$@"; }
                words=(${request.words})
                CURRENT=${request.current}
                _stam_local_completion
            `;
            const requestPath = path.join(root, 'equals-request');
            await fs.writeFile(requestPath, `${activation}\n${script}`);
            expect((await execute(shell, [requestPath], { env })).stdout.trim()).toBe(request.expected);
        }
    }, 30_000);

    it('retains the maintained generator for command and flag suggestions', async () => {
        const { stdout: activation } = await execute('stam', ['completion', 'bash'], { env });
        const requestPath = path.join(root, 'request');
        await fs.writeFile(requestPath, `${activation}
            COMP_WORDS=(stam docs image pu)
            COMP_CWORD=3
            _stam_local_completion
            printf '%s\\n' "\${COMPREPLY[@]}"
            COMP_WORDS=(stam docs image publish --en)
            COMP_CWORD=4
            _stam_local_completion
            printf '%s\\n' "\${COMPREPLY[@]}"
        `);
        const { stdout } = await execute('bash', [requestPath], { env });
        expect(stdout).toContain('publish');
        expect(stdout).toContain('--environment');
    });

    it('returns all local environments for an empty request', async () => {
        expect((await execute('stam', ['completion', 'environments'], { env })).stdout.trim().split('\n')).toEqual(['example-blue', 'example-green']);
    });

    it.each(['bash', 'zsh'])('exports standalone %s completion usable after deleting the generation cache', async (shell, context) => {
        await requireShell(shell, context);
        const { stdout } = await execute('stam', ['completion', shell, '--standalone'], { env });
        expect(stdout).not.toContain(root);
        expect(stdout).not.toContain('example-blue');
        await fs.rm(path.join(root, 'cache'), { recursive: true, force: true });
        const completion = path.join(root, shell === 'bash' ? 'stam' : '_stam');
        await fs.writeFile(completion, stdout);
        const script = shell === 'bash' ? `
            source '${completion}'
            COMP_WORDS=(stam docs image publish v1 --environment example-b)
            COMP_CWORD=6
            _stam_local_completion
            printf '%s\\n' "\${COMPREPLY[@]}"
        ` : `
            fpath=('${root}' $fpath)
            autoload -Uz _stam
            compadd() { shift; print -l -- "$@"; }
            words=(stam docs image publish v1 --environment example-b)
            CURRENT=7
            _stam
        `;
        const requestPath = path.join(root, 'standalone-request');
        await fs.writeFile(requestPath, script);
        expect((await execute(shell, [requestPath], { env })).stdout.trim()).toBe('example-blue');
    });

    it('accepts explicit custom names rather than restricting parsing to suggestions', async () => {
        await fs.writeFile(modulePath, `export const docsPublishingProvider = {
            listEnvironments: async () => [],
            resolve: async environment => { throw new Error('Reached provider with custom environment: ' + environment); },
        };`);
        await expect(execute('stam', ['docs', 'image', 'publish', 'v1.2.3', '--environment', 'unlisted-custom', '--no-latest'], { env }))
            .rejects.toMatchObject({ stderr: expect.stringContaining('Reached provider with custom environment: unlisted-custom') });
    });
});
