import { Organization } from "@stamhoofd-backend/app/src/organizations/models/Organization";
import { Factory } from "@stamhoofd-backend/database";

import { User, UserWithOrganization } from "../models/User";

class Options {
    organization: Organization;
    password?: string;
}

export class UserFactory extends Factory<Options, User> {
    async create(): Promise<UserWithOrganization> {
        const email = "generated-email-" + this.randomString(20) + "@domain.com";
        const password = this.options.password ?? this.randomString(20);
        const user = await User.register(this.options.organization, email, password, "todo");
        if (!user) {
            throw new Error("Unexpected failure when creating user in factory");
        }
        return user;
    }
}
