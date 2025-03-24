import { Factory } from '@simonbackx/simple-database';
import { RecordCategory, RecordSettings, RecordType } from '@stamhoofd/structures';
import { RecordFactory, RecordOptions } from './RecordFactory';

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
            name: 'Record category ' + Math.floor(Math.random() * 10000),
            records,
        });
    }
}
