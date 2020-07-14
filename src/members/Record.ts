import { AutoEncoder, EnumDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';

import { RecordType, RecordTypeHelper } from "./RecordType";

export class Record extends AutoEncoder {
    @field({ decoder: new EnumDecoder(RecordType) })
    type: RecordType;

    @field({ decoder: StringDecoder })
    description = "";

    getText() {
        return RecordTypeHelper.getName(this.type);
    }
}
