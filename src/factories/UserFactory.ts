import { Factory } from "@simonbackx/simple-database";
import { KeyConstantsHelper, SensitivityLevel,Sodium } from '@stamhoofd/crypto';

import { Organization } from "../models/Organization";
import { User, UserWithOrganization } from "../models/User";

class Options {
    organization: Organization;
    email?: string;
    password?: string;
    /**
     * Default is true
     */
    verified?: boolean;
}

export class UserFactory extends Factory<Options, User> {
    async create(): Promise<UserWithOrganization> {
        const email = this.options.email ?? "generated-email-" + this.randomString(20) + "@domain.com";
        const password = this.options.password ?? this.randomString(20);

        const userKeyPair = await Sodium.generateEncryptionKeyPair();
        const authSignKeyConstants = await KeyConstantsHelper.create(SensitivityLevel.Admin)
        const authEncryptionKeyConstants = await KeyConstantsHelper.create(SensitivityLevel.Admin)
        const authSignKeyPair = await KeyConstantsHelper.getSignKeyPair(authSignKeyConstants, password)
        const authEncryptionSecretKey = await KeyConstantsHelper.getEncryptionKey(authEncryptionKeyConstants, password)
        
        const user = await User.register(this.options.organization, email, userKeyPair.publicKey, authSignKeyPair.publicKey, await Sodium.encryptMessage(userKeyPair.privateKey, authEncryptionSecretKey), authSignKeyConstants, authEncryptionKeyConstants);
        if (!user) {
            throw new Error("Unexpected failure when creating user in factory");
        }
        
        if (this.options.verified === undefined || this.options.verified === true) {
            user.verified = true;
            await user.save();
        }
        
        return user;
    }
}
