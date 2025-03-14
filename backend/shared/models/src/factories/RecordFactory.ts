import { Factory } from '@simonbackx/simple-database';
import { RecordSettings, RecordType } from '@stamhoofd/structures';

export class RecordOptions {
    type: RecordType;
    required?: boolean;
}

export class RecordFactory extends Factory<RecordOptions, RecordSettings> {
    create(): Promise<RecordSettings> {
        return Promise.resolve(
            RecordSettings.create({
                name: 'Record name ' + Math.floor(Math.random() * 10000),
                type: this.options.type,
                required: this.options.required ?? (this.options.type !== RecordType.Checkbox),
            }),
        );
    }
}
