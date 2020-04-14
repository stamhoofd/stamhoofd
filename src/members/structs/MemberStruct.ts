import { Encodeable } from "@/structs/classes/Encodeable";
import { Data } from "@/structs/classes/Data";
import { Member } from "../models/Member";

export class MemberStruct implements Encodeable {
    firstName: string;
    lastName: string;

    constructor(settings?: { member?: Member }) {
        if (settings?.member) {
            this.fromMember(settings?.member);
        }
    }

    fromMember(member: Member) {
        this.firstName = member.firstName;
        this.lastName = member.lastName;
    }

    static decode(data: Data): MemberStruct {
        const struct = new MemberStruct();
        struct.firstName = data.field("lastName").string;
        struct.lastName = data.field("lastName").string;

        return struct;
    }

    encode(): any {
        return this;
    }
}
