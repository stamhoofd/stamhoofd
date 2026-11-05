import { BaseCommand } from '../../../base-command.js';
import { translateCompress } from '../../../runtime/translate.js';

export default class TranslateCleanup extends BaseCommand {
    static summary = 'Merge duplicate translations and remove unused keys';
    static examples = ['stam translate manual cleanup'];

    async run(): Promise<void> {
        await this.parse(TranslateCleanup);
        await translateCompress();
    }
}
