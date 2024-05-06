import { Factory } from "@simonbackx/simple-database";
import { NewUser, Permissions } from '@stamhoofd/structures';

import { Organization } from "../models/Organization";
import { User } from "../models/User";
import { OrganizationFactory } from './OrganizationFactory';

class Options {
    organization?: Organization;
    email?: string;
    password?: string;
    firstName?: string;
    lastName?: string;
    /**
     * Default is true
     */
    verified?: boolean;
    permissions?: Permissions | null
}

export class UserFactory extends Factory<Options, User> {
    async create(): Promise<User> {
        let organization: Organization

        if (!this.options.organization) {
            const organizationFactory = new OrganizationFactory({})
            organization = await organizationFactory.create()
        } else {
            organization = this.options.organization
        }
        
        const email = this.options.email ?? "generated-email-" + this.randomString(20) + "@domain.com";
        const password = this.options.password ?? this.randomString(20);

        const user = await User.register(organization, NewUser.create({
            email,
            organizationId: organization.id,
            password
        }));
        if (!user) {
            throw new Error("Unexpected failure when creating user in factory");
        }

        user.permissions = this.options.permissions ?? null
        user.firstName = this.options.firstName ?? null;
        user.lastName = this.options.lastName ?? null;
        
        if (this.options.verified === undefined || this.options.verified === true) {
            user.verified = true;
        }
        await user.save();
        return user;
    }
}
