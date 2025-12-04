import { Factory } from '@simonbackx/simple-database';
import { NewUser, Permissions, UserPermissions } from '@stamhoofd/structures';

import { Organization } from '../models/Organization.js';
import { User } from '../models/User.js';
import { OrganizationFactory } from './OrganizationFactory.js';

class Options {
    organization?: Organization;
    email?: string;
    password?: string | null; // default to random password
    firstName?: string;
    lastName?: string;
    /**
     * Default is true
     */
    verified?: boolean;
    permissions?: Permissions | null;
    globalPermissions?: Permissions | null;
}

export class UserFactory extends Factory<Options, User> {
    async create(): Promise<User> {
        let organization: Organization | null = null;

        if (!this.options.organization && STAMHOOFD.userMode !== 'platform' && !this.options.globalPermissions) {
            const organizationFactory = new OrganizationFactory({});
            organization = await organizationFactory.create();
        }
        else {
            organization = this.options.organization ?? null;
        }

        const email = this.options.email ?? 'generated-email-' + this.randomString(20) + '@domain.com';
        const password = this.options.password ?? this.randomString(20);

        const user = await User.register(organization, NewUser.create({
            email,
            organizationId: organization?.id ?? null,
            password,
        }));
        if (!user) {
            throw new Error('Unexpected failure when creating user in factory');
        }

        if (this.options.permissions) {
            if (!organization) {
                throw new Error('Cannot set permissions without organization');
            }
            user.permissions = UserPermissions.create({});
            user.permissions.organizationPermissions.set(organization.id, this.options.permissions);
        }

        if (this.options.globalPermissions) {
            if (!user.permissions) {
                user.permissions = UserPermissions.create({});
            }
            user.permissions.globalPermissions = this.options.globalPermissions;
        }

        user.firstName = this.options.firstName ?? null;
        user.lastName = this.options.lastName ?? null;

        if (this.options.verified === undefined || this.options.verified === true) {
            user.verified = true;
        }
        if (this.options.password === null) {
            user.password = null;
        }
        await user.save();
        return user;
    }
}
