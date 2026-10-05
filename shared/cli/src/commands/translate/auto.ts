import { Command, Flags } from '@oclif/core';
import { translate, validateMachineTranslation } from '../../runtime/translate.js';
import type { TranslationStage } from '../../runtime/translate.js';
import { machineArgs, machineFlags } from '../../runtime/translation-flags.js';
import { confirm, info, success, warning } from '../../runtime/ux.js';
import { getProjectPath } from '../../context/project-path.js';
import { run, RunVerbosity } from '../../runtime/command-runner.js';
import { detectVcs, Vcs } from '../../runtime/vcs.js';

export default class TranslateAuto extends Command {
    static summary = 'Prepare translations for release: keys, cleanup, then machine';
    static description = 'Rewrite Dutch translation strings as keys, merge duplicates, remove unused keys, and translate missing or changed strings. Review and commit the generated changes separately before releasing. Source extraction and interactive review are not part of this flow.';
    static examples = ['stam translate auto', 'stam translate auto --locale fr --provider openai', 'stam translate auto --no-machine'];
    static flags = {
        ...machineFlags,
        'no-machine': Flags.boolean({ description: 'Only register keys and clean up; do not make AI requests' }),
        'yes': Flags.boolean({ char: 'y', description: 'Approve the flow without prompting (required in noninteractive terminals)' }),
    };

    async run(): Promise<void> {
        const { flags } = await this.parse(TranslateAuto);
        if (!flags.yes && !(process.stdin.isTTY && process.stdout.isTTY)) {
            this.error('Automatic translation needs confirmation. Run interactively or pass --yes. No translation files were changed.');
        }
        const machine = machineArgs(flags);
        const locales = flags['no-machine'] ? undefined : await validateMachineTranslation(machine);
        const root = getProjectPath();
        info(`Repository: ${root}`);
        info(`Flow: keys → cleanup${locales ? ' → machine' : ''}`);
        if (locales) {
            info(`Locales: ${locales.join(', ')}. Provider: ${flags.provider}.`);
            warning(flags.fake ? 'Fake translations will be written; no AI requests will be made.' : 'Machine translation can make paid AI requests.');
        }
        else {
            info('Machine translation is disabled. No AI requests will be made.');
        }
        warning('This rewrites source translation keys and translation files. Existing working-copy changes are preserved, but review the resulting diff before committing.');
        if (!flags.yes && !await confirm('Prepare translations for release?')) {
            info('Cancelled. No translation files were changed.');
            return;
        }
        let stage: TranslationStage = 'keys';
        let completed = 0;
        const labels = { keys: 'Register translation keys', cleanup: 'Merge duplicates and remove unused keys', machine: 'Translate missing or changed strings' };
        try {
            await translate({
                machine,
                skipMachine: flags['no-machine'],
                onStage: (next) => {
                    stage = next;
                    info(`[${++completed}/${locales ? 3 : 2}] ${labels[next]}`);
                },
            });
        }
        catch (error) {
            warning(`Stopped during ${stage}. Review any partial changes; the flow does not roll them back. Run stam translate manual ${stage} --help to investigate this step.`);
            throw error;
        }
        success('Translation preparation complete. Review and commit these changes separately before releasing.');
        const vcs = await detectVcs(root);
        const diff = await run(vcs === Vcs.Jj ? 'jj' : 'git', ['diff', '--stat'], { cwd: root, capture: true, allowFailure: true, verbosity: RunVerbosity.Quiet });
        if (diff.stdout.trim()) {
            info(`Current working-copy changes (including pre-existing edits):\n${diff.stdout.trim()}`);
        }
    }
}
