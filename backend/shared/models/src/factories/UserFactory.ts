import { Factory } from "@simonbackx/simple-database";
import { KeyConstantsHelper, SensitivityLevel,Sodium } from '@stamhoofd/crypto';
import { NewUser,Permissions } from '@stamhoofd/structures';

import { KeychainItem } from '../models/KeychainItem';
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
    organizationPrivateKey?: string;
}

export class UserFactory extends Factory<Options, UserWithOrganization> {
    lastPrivateKey!: string

    async create(): Promise<UserWithOrganization> {
        let organization: Organization

        if (!this.options.organization) {
            const organizationFactory = new OrganizationFactory({})
            organization = await organizationFactory.create()
            this.options.organizationPrivateKey = organizationFactory.lastPrivateKey
        } else {
            organization = this.options.organization
        }
        
        const email = this.options.email ?? "generated-email-" + this.randomString(20) + "@domain.com";
        const password = this.options.password ?? this.randomString(20);

        const userKeyPair = await Sodium.generateEncryptionKeyPair();
        const authSignKeyConstants = await KeyConstantsHelper.create(SensitivityLevel.Tests)
        const authEncryptionKeyConstants = await KeyConstantsHelper.create(SensitivityLevel.Tests)
        const authSignKeyPair = await KeyConstantsHelper.getSignKeyPair(authSignKeyConstants, password)
        const authEncryptionSecretKey = await KeyConstantsHelper.getEncryptionKey(authEncryptionKeyConstants, password)
        
        const user = await User.register(organization, NewUser.create({
            email,
            publicKey: userKeyPair.publicKey, 
            publicAuthSignKey: authSignKeyPair.publicKey, 
            encryptedPrivateKey: await Sodium.encryptMessage(userKeyPair.privateKey, authEncryptionSecretKey),
            authSignKeyConstants, 
            authEncryptionKeyConstants
        }));
        if (!user) {
            throw new Error("Unexpected failure when creating user in factory");
        }

        user.permissions = this.options.permissions ?? null
        
        if (this.options.verified === undefined || this.options.verified === true) {
            user.verified = true;
        }
        await user.save();

        if (this.options.organizationPrivateKey && user.publicKey) {
            if (this.options.permissions) {
                // Add the private key to the keychain for this user (if possible)
                const keychainItem = new KeychainItem()
                keychainItem.userId = user.id
                keychainItem.publicKey = organization.publicKey
                keychainItem.encryptedPrivateKey = await Sodium.sealMessageAuthenticated(
                    this.options.organizationPrivateKey,
                    user.publicKey,
                    userKeyPair.privateKey
                )
                await keychainItem.save()
            } else {
                if (this.options.organization) {
                    // Only thow error if explicitly added the private key
                    throw new Error("Not allowed to create keychain item when you don't have permissions to access the organization")
                }
            }
        }

        this.lastPrivateKey = userKeyPair.privateKey
        return user;
    }
}
