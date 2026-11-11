import { Args, Command, Flags } from '@oclif/core';
import fs from 'node:fs/promises';
import path from 'node:path';
import { docsEnvironmentCompletionScript, standaloneCompletionScript } from '../../runtime/completion.js';

export default class Completion extends Command {
    static hidden = true;
    static summary = 'Print Bash or Zsh activation for command, flag and docs environment completion';
    static args = { shell: Args.string({ required: true, options: ['bash', 'zsh'] }) };
    static flags = { standalone: Flags.boolean({ description: 'Export a standalone file for the shell completion search path' }) };

    async run(): Promise<void> {
        const { args, flags } = await this.parse(Completion);
        // The maintained generator owns command/flag completion; the bridge adds live local values.
        const previous = process.umask(0o077);
        try {
            await fs.mkdir(this.config.cacheDir, { recursive: true, mode: 0o700 });
            await fs.chmod(this.config.cacheDir, 0o700);
            await this.config.runCommand('autocomplete:create');
        } finally {
            process.umask(previous);
        }
        const cache = path.join(this.config.cacheDir, 'autocomplete');
        if (flags.standalone) {
            const generated = await fs.readFile(path.join(cache, 'functions', args.shell, args.shell === 'bash' ? 'stam.bash' : '_stam'), 'utf8');
            this.log(standaloneCompletionScript(args.shell, generated));
        }
        else this.log(docsEnvironmentCompletionScript(args.shell, cache));
    }
}
