import { Factory } from "@simonbackx/simple-database";
import { LegacyRecord, LegacyRecordType } from '@stamhoofd/structures';

interface Options {}

export class RecordFactory extends Factory<Options, LegacyRecord> {LegacyRecordLegacyRecord
    create(): Promise<LegacyRecord> {
        return Promise.resolve(LegacyRecord.create({
            type: this.randomArray(Object.values(LegacyRecordType))
        }));
    }
}
