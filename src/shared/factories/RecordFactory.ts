import { Record } from "../models/Record";
import { RecordType } from "../models/RecordType";
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
