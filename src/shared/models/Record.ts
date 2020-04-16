import { Gender } from "./Gender";
import { Address } from "./Address";
import { Parent } from "./Parent";
import { EmergencyContact } from "./EmergencyContact";
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
