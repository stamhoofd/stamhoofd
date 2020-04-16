import { Data } from "@/structs/classes/Data";
import { RegisterStruct } from "@/users/structs/RegisterStruct";

export class CreateOrganizationStruct {
    name: string;

    /**
     * publicKey of the organization, will get used to check administrator public key signatures. This key should not change often, and should get trusted by clients on first use
     */
    publicKey: string;

    /**
     * Contains the secret of the organization (used to sign administrators public keys), encrypted with the user that is going to get created
     */
    encryptedSecret: string;
    user: RegisterStruct;

    static decode(data: Data): CreateOrganizationStruct {
        const s = new CreateOrganizationStruct();
        s.name = data.field("name").string;
        s.publicKey = data.field("publicKey").key;
        s.encryptedSecret = data.field("encryptedSecret").base64;
        s.user = data.field("user").decode(RegisterStruct);
        return s;
    }
}
