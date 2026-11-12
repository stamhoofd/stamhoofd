import { Args } from '@oclif/core';
import { BaseCommand } from '../../../base-command.js';
import { RunVerbosity } from '../../../runtime/command-runner.js';
import { buildDocsImage } from '../../../runtime/docs-image.js';

export default class DocsImageBuild extends BaseCommand {
    static override verbosity = RunVerbosity.Output;
    static summary = 'Build the docs server image for linux/amd64';
    static args = {
        tag: Args.string({ required: true, description: 'Local image tag, for example v1.2.3' }),
    };
    static flags = { ...this.verbosityFlags() };

    async run(): Promise<void> {
        const { args, context } = await this.parseWithContext(DocsImageBuild);
        await buildDocsImage(context.rootDir, args.tag, context.verbosity);
    }
}
