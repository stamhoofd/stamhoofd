import { Encodeable } from '../../structs/classes/Encodeable';
import { Data } from '../../structs/classes/Data';
import { StringDecoder } from '../../classes/decoding/StringDecoder';
import { Member } from '../models/Member';

export class MemberStruct implements Encodeable {
    firstName: string
    lastName: string

    constructor(settings?: { member?: Member }) {
        if (settings?.member) {
            this.fromMember(settings?.member)
        }
    }

    fromMember(member: Member) {
        this.firstName = member.firstName
        this.lastName = member.lastName
    }

    static decode(data: Data): MemberStruct {
        const struct = new MemberStruct()
        struct.firstName = data.field("lastName").decode(StringDecoder);
        struct.lastName = data.field("lastName").decode(StringDecoder);

        return struct
    }

    encode(): any {
        return this;
    }
}
