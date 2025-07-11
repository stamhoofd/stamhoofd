import { type MemberResponsibilityRecordBase } from './members/MemberResponsibilityRecord.js';
import { type Organization } from './Organization.js';
import { Platform } from './Platform.js';
import { User } from './User.js';

export class MemberAdmin {
    users: User[] = [];

    constructor(data: { users: User[] }) {
        this.users = data.users;
    }

    get id() {
        return this.users[0].memberId ?? 'unknown';
    }

    get name() {
        const withName = this.users.find(u => !!u.name);
        return withName ? withName.name : this.users[0].email;
    }

    getResponsibilities(organization: Organization | null) {
        const responsibilities = new Map<string, MemberResponsibilityRecordBase>();

        for (const user of this.users) {
            const permission = organization ? user.permissions?.organizationPermissions.get(organization.id) : user.permissions?.globalPermissions;
            if (permission) {
                for (const responsibility of permission.responsibilities) {
                    responsibilities.set(responsibility.responsibilityId, responsibility);
                }
            }
        }

        return [...responsibilities.values()].flatMap((r) => {
            // Find name of this responsibility
            if (r.organizationId && r.organizationId === organization?.id) {
                const name = organization?.privateMeta?.responsibilities.find(res => res.id === r.responsibilityId)?.name;
                if (name) {
                    return [name];
                }
            }

            const name = Platform.shared.config.responsibilities.find(res => res.id === r.responsibilityId)?.name;
            if (name) {
                return [name];
            }
            return [];
        });
    }
}
