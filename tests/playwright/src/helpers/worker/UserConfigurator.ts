import { Organization, User } from "@stamhoofd/models";
import {
    Permissions,
    UserPermissions
} from "@stamhoofd/structures";

/**
 * Helper class with methods to configure the state of the user.
 */
export class UserConfigurator {
    constructor(private readonly user: User) {}
    /**
     *
     * @param permissions
     * @param organization defaults to default worker organization
     * @returns
     */
    setOrganizationPermissions(
        permissions: Permissions,
        organization: Organization,
    ) {
        const user = this.user;
        user.permissions = UserPermissions.create({});

        user.permissions.organizationPermissions.set(
            organization.id,
            permissions,
        );

        return this;
    }

    async save() {
        await this.user.save();
    }
}
