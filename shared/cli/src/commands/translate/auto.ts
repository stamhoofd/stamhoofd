import { Command, Flags } from '@oclif/core';
import { translate } from '../../runtime/translate.js';
import { machineArgs, machineFlags } from '../../runtime/translation-flags.js';

export default class TranslateAuto extends Command {
    static summary = 'Prepare translations for release: keys, cleanup, then machine';
    static description = 'Rewrite Dutch translation strings as keys, merge duplicates, remove unused keys, and translate missing or changed strings. Review and commit the generated changes separately before releasing. Source extraction and interactive review are not part of this flow.';
    static examples = ['stam translate auto', 'stam translate auto --locale fr --provider openai', 'stam translate auto --no-machine'];
    static flags = {
        ...machineFlags,
        'no-machine': Flags.boolean({ description: 'Only register keys and clean up; do not make AI requests' }),
    };

    async run(): Promise<void> {
        const { flags } = await this.parse(TranslateAuto);
        await translate({ machine: machineArgs(flags), skipMachine: flags['no-machine'] });
    }
}
