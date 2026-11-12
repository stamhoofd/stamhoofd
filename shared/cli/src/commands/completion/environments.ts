import { Args, Command } from '@oclif/core';
import path from 'node:path';
import { getProjectPath } from '../../context/project-path.js';
import { getOptionalDocsPublishingProvider } from '../../runtime/devops-plugin.js';

/** Completion is deliberately separate from publishing resolution: no prompts or credentials. */
export default class CompletionEnvironments extends Command {
    static hidden = true;
    static args = { prefix: Args.string({ default: '' }) };

    async run(): Promise<void> {
        const { args } = await this.parse(CompletionEnvironments);
        const provider = await getOptionalDocsPublishingProvider(
            path.join(getProjectPath(), 'devops'),
        );
        if (!provider) return;
        for (const { value } of await provider.listEnvironments()) {
            if (/^[a-z][a-z0-9-]*$/.test(value) && value.startsWith(args.prefix ?? ''))
                this.log(value);
        }
    }
}
