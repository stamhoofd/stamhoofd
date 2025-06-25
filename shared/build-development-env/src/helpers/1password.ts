import { exec } from 'child_process';
import util from 'util';
const execPromise = util.promisify(exec);

export function escapeShellArg(arg) {
    return `'${arg.replace(/'/g, `'\\''`)}'`;
}

/**
 * A bit slower - uses local 1Password CLI
 */
export async function read1PasswordCli(key: string, options?: { optional: boolean }): Promise<string> {
    // Read key from 1Password
    const result = await execPromise(`op read ${escapeShellArg(key)}`);
    const value = result.stdout;

    // Remove trailing newline (only 1)
    const val = value.substring(0, value.length - 1);

    if (val === '') {
        if (options?.optional) {
            return '';
        }
        throw new Error('Key not found in 1Password: ' + key);
    }

    return val;
}
