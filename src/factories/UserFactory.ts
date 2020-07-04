import { Factory } from "@simonbackx/simple-database";

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
        const user = await User.register(this.options.organization, email, password, "todo");
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
