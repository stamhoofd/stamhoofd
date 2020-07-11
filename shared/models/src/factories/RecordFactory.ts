import { Record } from "../Record";
import { RecordType } from "../RecordType";
import { Factory } from "./Factory";
interface Options {}

export class RecordFactory extends Factory<Record> {
    options: Options;

    constructor(options: Options) {
        super(options);
        this.options = options;
    }

    create(): Record {
        return new Record(this.randomArray(Object.keys(RecordType)));
    }
}
