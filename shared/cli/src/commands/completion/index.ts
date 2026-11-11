import { Args, Command } from '@oclif/core';
import fs from 'node:fs/promises';
import path from 'node:path';
import { docsEnvironmentCompletionScript } from '../../runtime/completion.js';

export default class Completion extends Command {
    static summary = 'Print Bash or Zsh activation for command, flag and docs environment completion';
    static args = { shell: Args.string({ required: true, options: ['bash', 'zsh'] }) };

    async run(): Promise<void> {
        const { args } = await this.parse(Completion);
        // The maintained generator owns command/flag completion; the bridge adds live local values.
        const previous = process.umask(0o077);
        try {
            await fs.mkdir(this.config.cacheDir, { recursive: true, mode: 0o700 });
            await fs.chmod(this.config.cacheDir, 0o700);
            await this.config.runCommand('autocomplete:create');
        } finally {
            process.umask(previous);
        }
        this.log(docsEnvironmentCompletionScript(args.shell, path.join(this.config.cacheDir, 'autocomplete')));
    }
}
