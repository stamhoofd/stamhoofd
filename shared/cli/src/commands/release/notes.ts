import { Command, Flags } from '@oclif/core';
import { getProjectPath } from '../../context/project-path.js';
import { writeOutputLine } from '../../runtime/output-target.js';
import { composeReleaseNotesBody } from '../../runtime/release-notes-translator.js';
import { buildReleaseNotes, getLatestVersionTag, getRepositorySlug, renderReleaseNotes } from '../../runtime/release-notes.js';
import { info, warning } from '../../runtime/ux.js';

export default class ReleaseNotes extends Command {
    static summary = 'Preview release notes for the pending (unreleased) changes';
    static description = 'Summarizes every commit that starts with an emoji since the latest version tag, grouped into sections, and appends an AI-generated Dutch translation for end users. Use this to see what a new release would contain without publishing anything.';
    static examples = [
        'stam release notes',
        'stam release notes --from v2.123.0 --to HEAD',
        'stam release notes --no-translate',
    ];

    static flags = {
        'from': Flags.string({ description: 'Start ref (exclusive). Defaults to the latest version tag.' }),
        'to': Flags.string({ description: 'End ref (inclusive).', default: 'HEAD' }),
        'no-translate': Flags.boolean({ description: 'Skip the AI-generated Dutch translation.', default: false }),
        'provider': Flags.string({ description: 'Translation provider: openai (default) or claude. Defaults to RELEASE_NOTES_AI_PROVIDER.' }),
        'model': Flags.string({ description: 'Translation model. Defaults to RELEASE_NOTES_AI_MODEL or the provider default.' }),
    };

    async run(): Promise<void> {
        const { flags } = await this.parse(ReleaseNotes);
        const cwd = getProjectPath();

        const from = flags.from ?? await getLatestVersionTag(cwd);
        const repositorySlug = await getRepositorySlug(cwd);
        const notes = await buildReleaseNotes(cwd, { from, to: flags.to, repositorySlug });
        const markdown = renderReleaseNotes(notes, { repositorySlug });

        const body = await composeReleaseNotesBody(cwd, notes, markdown, {
            skipTranslation: flags['no-translate'],
            provider: flags.provider,
            model: flags.model,
            onInfo: info,
            onWarn: warning,
        });

        const range = from ? `${from}..${flags.to}` : flags.to;
        info(`Pending changes in ${range} (${notes.commits.length} emoji commit${notes.commits.length === 1 ? '' : 's'}):\n`);
        writeOutputLine(body);
    }
}
