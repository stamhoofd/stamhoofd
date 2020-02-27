import { Gender } from "./Gender";
import { Address } from "./Address";
import { Parent } from "./Parent";
import { EmergencyContact } from "./EmergencyContact";
import { RecordType } from "./RecordType";

export class Record {
    type: RecordType;
    description: string = "";

    constructor(type: RecordType) {
        this.type = type;
    }
}
