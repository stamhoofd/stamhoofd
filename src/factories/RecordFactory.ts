import { Factory } from "@simonbackx/simple-database";
import { Record, RecordType } from '@stamhoofd/structures';

interface Options {}

export class RecordFactory extends Factory<Options, Record> {
    create(): Promise<Record> {
        return Promise.resolve(Record.create({
            type: this.randomArray(Object.keys(RecordType))
        }));
    }
}
