import { Command, Flags } from '@oclif/core';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getProjectPath } from '../../context/project-path.js';
import { run } from '../../runtime/command-runner.js';
import { writeOutputLine } from '../../runtime/output-target.js';
import { announceRelease } from '../../runtime/release-announcement.js';
import { composeReleaseNotesBody } from '../../runtime/release-notes-translator.js';
import { buildReleaseNotes, getPreviousVersionTag, getReleaseVersion, getRepositorySlug, renderReleaseNotes } from '../../runtime/release-notes.js';
import { resolveSlackConfig } from '../../runtime/slack.js';
import { info, success, warning } from '../../runtime/ux.js';

export default class ReleasePublish extends Command {
    static summary = 'Publish release notes for the current version tag to GitHub';
    static description = 'Generates release notes from the emoji commits since the previous version tag and creates (or updates) the matching GitHub release. When a new release is created it is also announced in the Slack #development channel, with the release notes posted as thread replies. Runs automatically as part of "yarn ship" after the git tags are pushed.';
    static examples = [
        'stam release publish',
        'stam release publish --dry-run',
        'stam release publish --tag v2.124.0',
    ];

    static flags = {
        'tag': Flags.string({ description: 'Tag to publish a release for. Defaults to v<lerna.json version>.' }),
        'from': Flags.string({ description: 'Previous tag to compare against. Defaults to the preceding version tag.' }),
        'dry-run': Flags.boolean({ description: 'Print the release notes instead of creating the GitHub release.', default: false }),
        'no-slack': Flags.boolean({ description: 'Skip announcing the release in the Slack #development channel.', default: false }),
        'no-translate': Flags.boolean({ description: 'Skip the AI-generated Dutch translation.', default: false }),
        'provider': Flags.string({ description: 'Translation provider: openai (default) or claude. Defaults to RELEASE_NOTES_AI_PROVIDER.' }),
        'model': Flags.string({ description: 'Translation model. Defaults to RELEASE_NOTES_AI_MODEL or the provider default.' }),
    };

    async run(): Promise<void> {
        const { flags } = await this.parse(ReleasePublish);
        const cwd = getProjectPath();

        const tag = flags.tag ?? `v${await getReleaseVersion(cwd)}`;
        const from = flags.from ?? await getPreviousVersionTag(cwd, tag);
        const repositorySlug = await getRepositorySlug(cwd);

        const notes = await buildReleaseNotes(cwd, { from, to: tag, repositorySlug });
        const markdown = renderReleaseNotes(notes, { repositorySlug });
        const body = await composeReleaseNotesBody(cwd, notes, markdown, {
            skipTranslation: flags['no-translate'],
            provider: flags.provider,
            model: flags.model,
            onInfo: info,
            onWarn: warning,
        });

        if (flags['dry-run']) {
            info(`Release notes for ${tag} (${from ?? 'start'}..${tag}):\n`);
            writeOutputLine(body);
            return;
        }

        const notesFile = join(tmpdir(), `stam-release-notes-${tag.replace(/[^\w.-]/g, '_')}.md`);
        await writeFile(notesFile, body, 'utf8');

        const repoArgs = repositorySlug ? ['--repo', repositorySlug] : [];

        const existing = await run('gh', ['release', 'view', tag, ...repoArgs], { cwd, capture: true, allowFailure: true });
        if (existing.status === 0) {
            warning(`A GitHub release for ${tag} already exists, updating its notes.`);
            await run('gh', ['release', 'edit', tag, ...repoArgs, '--notes-file', notesFile], { cwd });
            success(`Updated GitHub release ${tag}.`);
            return;
        } else {
            await run('gh', ['release', 'create', tag, ...repoArgs, '--title', tag, '--notes-file', notesFile, '--verify-tag', '--latest'], { cwd });
            success(`Published GitHub release ${tag}.`);
        }

        if (!flags['no-slack']) {
            const releaseUrl = repositorySlug ? `https://github.com/${repositorySlug}/releases/tag/${tag}` : undefined;
            await this.announceOnSlack(tag, releaseUrl, body);
        }
    }

    /** Posts the release announcement to Slack #development. Failures only warn — the release is already live. */
    private async announceOnSlack(tag: string, releaseUrl: string | undefined, body: string): Promise<void> {
        const resolution = await resolveSlackConfig();
        if ('unavailable' in resolution) {
            warning(`Skipping Slack announcement: ${resolution.unavailable}.`);
            return;
        }

        try {
            info('Announcing the release in Slack #development…');
            const { replyCount } = await announceRelease(resolution.config, { tag, releaseUrl, notesBody: body });
            success(`Announced ${tag} in Slack (release notes in ${replyCount} thread ${replyCount === 1 ? 'reply' : 'replies'}).`);
        } catch (error) {
            warning(`Could not announce the release in Slack: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
