import { User, UserWithOrganization } from "../models/User";
import { Factory } from "@/database/classes/Factory";
import { Organization } from "@/organizations/models/Organization";

class Options {
    organization: Organization;
}

export class UserFactory extends Factory<Options, User> {
    async create(): Promise<UserWithOrganization> {
        const email = "generated-email-" + this.randomString(20) + "@domain.com";
        const password = this.randomString(20);
        const user = await User.register(this.options.organization, email, password, "todo");
        if (!user) {
            throw new Error("Unexpected failure when creating user in factory");
        }
        return user;
    }
}
