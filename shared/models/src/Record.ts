import { RecordType, RecordTypeHelper } from "./RecordType";

export class Record {
    type: RecordType;
    description = "";

    constructor(type: RecordType) {
        this.type = type;
    }

    getText() {
        return RecordTypeHelper.getName(this.type);
    }
}
