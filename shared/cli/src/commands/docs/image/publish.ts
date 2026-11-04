import { Args } from '@oclif/core';
import { BaseCommand } from '../../../base-command.js';
import { RunVerbosity } from '../../../runtime/command-runner.js';
import { publishDocsImage } from '../../../runtime/docs-image.js';

export default class DocsImagePublish extends BaseCommand {
    static override verbosity = RunVerbosity.Output;
    static summary = 'Push a previously built docs image to STAM_DOCS_REGISTRY';
    static description = 'Authenticate with docker login first. This command does not build or deploy the image, or update latest.';
    static args = { tag: Args.string({ required: true, description: 'Previously built local image tag' }) };
    static flags = { ...this.verbosityFlags() };

    async run(): Promise<void> {
        const { args, context } = await this.parseWithContext(DocsImagePublish);
        await publishDocsImage(context.rootDir, args.tag, process.env.STAM_DOCS_REGISTRY, context.verbosity);
    }
}
