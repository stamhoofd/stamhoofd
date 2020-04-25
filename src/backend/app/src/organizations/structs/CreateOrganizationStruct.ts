import { Data, Encodeable } from '@stamhoofd-common/encoding';
import { STError, STErrors } from '@stamhoofd-common/errors';

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
        const errors = new STErrors()
        const s = new CreateOrganizationStruct();

        try {
            s.name = data.field("name").string;

            if (s.name.length < 4) {
                if (s.name.length == 0) {
                    throw new STError({
                        code: "invalid_field",
                        message: "Should not be empty",
                        human: "Je bent de naam van je organisatie vergeten in te vullen",
                        field: data.addToCurrentField("name")
                    })
                }

                throw new STError({
                    code: "invalid_field",
                    message: "Field is too short",
                    human: "Kijk de naam van je organisatie na, deze is te kort",
                    field: data.addToCurrentField("name")
                })
            }
        } catch (e) {
            errors.addError(e)
        }

        try {
            s.user = data.field("user").decode(RegisterStruct);
        } catch (e) {
            errors.addError(e)
        }

        try {
            s.publicKey = data.field("publicKey").key;
        } catch (e) {
            errors.addError(e)
        }

        errors.throwIfNotEmpty()
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
