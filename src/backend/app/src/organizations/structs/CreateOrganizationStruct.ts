import { Data, Encodeable } from '@stamhoofd-common/encoding';

import { RegisterStruct } from "../../users/structs/RegisterStruct";

export class CreateOrganizationStruct implements Encodeable {
    name: string;

    /**
     * publicKey of the organization, will get used to check administrator public key signatures. This key should not change, and should get trusted by clients on first use (or via special servers to be added)
     * Between administrators, this key is only trusted via a secure third party channel when administrators invite other administrators
     */
    publicKey: string;
    user: RegisterStruct;

    static decode(data: Data): CreateOrganizationStruct {
        const s = new CreateOrganizationStruct();
        s.name = data.field("name").string;
        s.publicKey = data.field("publicKey").key;
        s.user = data.field("user").decode(RegisterStruct);
        return s;
    }

    encode() {
        return {
            name: this.name,
            publicKey: this.publicKey,
            user: this.user.encode()
        }
    }
}
