import { exec } from 'child_process';
import util from 'util';
import { cache } from './cache.js';
import { Formatter } from '@stamhoofd/utility';
const execPromise = util.promisify(exec);

export function escapeShellArg(arg) {
    return `'${arg.replace(/'/g, `'\\''`)}'`;
}

/**
 * A bit slower - uses local 1Password CLI
 */
export async function read1PasswordCli(key: string, options?: { optional: boolean }): Promise<string> {
    return await cache(Formatter.slug('1password-cli-' + key), async () => {
        // Read key from 1Password
        try {
            const result = await execPromise(`op read --account stamhoofd.1password.eu ${escapeShellArg(key)}`);
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
        catch (e) {
            if (e.message && e.message.includes('found no accounts for filter')) {
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
            throw e;
        }
    });
}
