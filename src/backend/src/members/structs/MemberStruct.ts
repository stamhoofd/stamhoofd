import { Encodeable } from "@stamhoofd-common/encoding/src/classes/Encodeable";
import { Data } from "@stamhoofd-common/encoding/src/classes/Data";
import { Member } from "../models/Member";

export class MemberStruct implements Encodeable {
    organizationId: number;
    encrypted: string;

    constructor(settings?: { member?: Member }) {
        if (settings?.member) {
            this.fromMember(settings?.member);
        }
    }

    fromMember(member: Member) {
        this.organizationId = member.organizationId;
        this.encrypted = member.encrypted;
    }

    static decode(data: Data): MemberStruct {
        const struct = new MemberStruct();
        struct.organizationId = data.field("organizationId").number;
        struct.encrypted = data.field("encrypted").string;

        return struct;
    }

    encode(): any {
        return this;
    }
}
