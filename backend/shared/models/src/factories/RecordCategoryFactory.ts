import { Factory } from '@simonbackx/simple-database';
import type { RecordSettings} from '@stamhoofd/structures';
import { RecordCategory, TranslatedString } from '@stamhoofd/structures';
import type { RecordOptions } from './RecordFactory.js';
import { RecordFactory } from './RecordFactory.js';

class Options {
    records: RecordOptions[];
}

export class RecordCategoryFactory extends Factory<Options, RecordCategory> {
    async create(): Promise<RecordCategory> {
        const records: RecordSettings[] = [];
        for (const record of this.options.records) {
            records.push(
                await new RecordFactory(record).create(),
            );
        }

        return RecordCategory.create({
            name: TranslatedString.create('Record category ' + Math.floor(Math.random() * 10000)),
            records,
        });
    }
}
