import { Factory } from "@simonbackx/simple-database";
import { KeyConstantsHelper, SensitivityLevel,Sodium } from '@stamhoofd/crypto';
import { Permissions } from '@stamhoofd/structures';

import { Organization } from "../models/Organization";
import { User, UserWithOrganization } from "../models/User";
import { OrganizationFactory } from './OrganizationFactory';

class Options {
    organization?: Organization;
    email?: string;
    password?: string;
    /**
     * Default is true
     */
    verified?: boolean;
    permissions?: Permissions | null
}

export class UserFactory extends Factory<Options, UserWithOrganization> {
    lastPrivateKey!: string

    async create(): Promise<UserWithOrganization> {
        const organization = this.options.organization ?? await new OrganizationFactory({}).create()
        const email = this.options.email ?? "generated-email-" + this.randomString(20) + "@domain.com";
        const password = this.options.password ?? this.randomString(20);

        const userKeyPair = await Sodium.generateEncryptionKeyPair();
        const authSignKeyConstants = await KeyConstantsHelper.create(SensitivityLevel.Tests)
        const authEncryptionKeyConstants = await KeyConstantsHelper.create(SensitivityLevel.Tests)
        const authSignKeyPair = await KeyConstantsHelper.getSignKeyPair(authSignKeyConstants, password)
        const authEncryptionSecretKey = await KeyConstantsHelper.getEncryptionKey(authEncryptionKeyConstants, password)
        
        const user = await User.register(organization, email, userKeyPair.publicKey, authSignKeyPair.publicKey, await Sodium.encryptMessage(userKeyPair.privateKey, authEncryptionSecretKey), authSignKeyConstants, authEncryptionKeyConstants);
        if (!user) {
            throw new Error("Unexpected failure when creating user in factory");
        }

        user.permissions = this.options.permissions ?? null
        
        if (this.options.verified === undefined || this.options.verified === true) {
            user.verified = true;
        }
        await user.save();

        this.lastPrivateKey = userKeyPair.privateKey
        return user;
    }
}
