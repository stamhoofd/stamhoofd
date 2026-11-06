import concurrently, { Logger } from 'concurrently';
import type { Command } from 'concurrently';

/**
 * Runs named development commands independently of the CLI's rebuildable dist.
 * Usage: node concurrently.js <comma-separated names> <command> [...commands].
 * Inherits cwd/environment. Concurrently owns signal forwarding and failure handling;
 * only its orchestration notices are shortened. Child output is never filtered.
 * STAM_DEV_VERBOSE=1 retains the original command and signal diagnostics.
 */
const [names, ...commands] = process.argv.slice(2);
const verbose = process.env.STAM_DEV_VERBOSE === '1';
let stopping = false;
const onSignal = () => { stopping = true; };
process.on('SIGINT', onSignal);
process.on('SIGTERM', onSignal);

class DevLogger extends Logger {
    override logCommandEvent(text: string, command: Command) {
        const prefix = `${command.command} exited with code `;
        if (!verbose && text.startsWith(prefix)) {
            const code = text.slice(prefix.length);
            if (stopping && ['0', 'SIGINT', 'SIGTERM'].includes(code)) return;
            text = `exited with code ${code}`;
        }
        super.logCommandEvent(text, command);
    }

    override logGlobalEvent(text: string) {
        if (!verbose && stopping && text === 'Sending SIGTERM to other processes..') return;
        super.logGlobalEvent(text);
    }
}

const { result } = concurrently(commands.map((command, index) => ({ command, name: names.split(',')[index] })), {
    logger: new DevLogger({ prefixFormat: '[{name}]' }),
    killOthersOn: ['failure'],
});
await result.catch(() => { process.exitCode = 1; });
process.off('SIGINT', onSignal);
process.off('SIGTERM', onSignal);
