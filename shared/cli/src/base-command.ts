import { Command, Flags } from '@oclif/core';
import { createContext } from './context/create-context.js';
import type { CliContext } from './context/create-context.js';

export abstract class BaseCommand extends Command {
    static verboseFlags = {
        verbose: Flags.boolean({ description: 'Print extra diagnostics while running', default: false }),
    };

    static environmentFlags = {
        env: Flags.string({ description: 'Environment to use, such as stamhoofd or keeo', default: 'stamhoofd' }),
        ...BaseCommand.verboseFlags,
    };

    static instanceFlags = {
        ...BaseCommand.environmentFlags,
        name: Flags.string({ description: 'Instance name to use instead of the inferred workspace name' }),
    };

    protected async createContext(flags: { env?: string; name?: string; verbose?: boolean }): Promise<CliContext> {
        return await createContext({
            env: flags.env ?? 'stamhoofd',
            instanceName: flags.name,
            verbose: flags.verbose ?? false,
        });
    }
}
