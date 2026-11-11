import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../../../base-command.js';
import { RunVerbosity } from '../../../runtime/command-runner.js';
import { docsImageReference, publishDocsImage } from '../../../runtime/docs-image.js';
import { resolveDocsPublishingConfig } from '../../../runtime/docs-publishing.js';
import * as prompts from '../../../runtime/prompts.js';

export default class DocsImagePublish extends BaseCommand {
    static override verbosity = RunVerbosity.Output;
    static summary = 'Push a previously built docs image to a configured registry';
    static description = 'Supplied registry credentials use temporary isolated authentication. Without credentials, authenticate with podman login or docker login first. Choose --latest to also point latest to this image, or --no-latest to publish only the requested tag. This command does not build or deploy the image.';
    static args = { tag: Args.string({ required: true, description: 'Previously built local image tag' }) };
    static flags = {
        ...this.verbosityFlags(),
        environment: Flags.string({ description: 'Infrastructure environment from the optional DevOps checkout (required without an interactive terminal)' }),
        latest: Flags.boolean({ allowNo: true, description: 'Also point the latest tag to this image (prompts if omitted; required explicitly without an interactive terminal)' }),
    };

    async run(): Promise<void> {
        const { args, flags, context } = await this.parseWithContext(DocsImagePublish);
        docsImageReference(args.tag);
        let latest = flags.latest;
        if (latest === undefined) {
            prompts.requireInteractive('Pass --latest or --no-latest when publishing without an interactive terminal.');
            latest = await prompts.confirm({ message: "Point the 'latest' tag to this image as well?", default: false });
        }
        const config = await resolveDocsPublishingConfig(context.rootDir, flags.environment);
        await publishDocsImage(context.rootDir, args.tag, config, context.verbosity, latest);
    }
}
