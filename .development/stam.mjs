import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const tasks = ['@stamhoofd/cli#build'];
if (existsSync(new URL('../devops/tsconfig.cli.json', import.meta.url))) {
    tasks.push('//#build:stam-devops');
}

function run(command, args, stdio) {
    const result = spawnSync(command, args, { cwd: root, stdio });
    if (result.error || result.status !== 0) {
        if (result.stdout) {
            process.stderr.write(result.stdout);
        }
        if (result.stderr) {
            process.stderr.write(result.stderr);
        }
    }
    if (result.error) {
        throw result.error;
    }
    if (result.signal) {
        process.kill(process.pid, result.signal);
        process.exit(1);
    }
    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

// Successful bootstrap builds are silent; failures are reported on stderr.
run('pnpm', ['exec', 'turbo', 'run', ...tasks, '--output-logs=errors-only', '--no-update-notifier'], ['inherit', 'pipe', 'pipe']);
run(process.execPath, ['--use-system-ca', 'shared/cli/bin/stam.js', ...process.argv.slice(2)], 'inherit');
