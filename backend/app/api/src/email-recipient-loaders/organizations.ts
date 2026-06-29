import type { Organization, User } from '@stamhoofd/models';
import { Platform } from '@stamhoofd/models';
import { Email } from '@stamhoofd/models';
import type { InMemoryFilterDefinitions, LimitedFilteredRequest, StamhoofdFilter, Platform as PlatformStruct } from '@stamhoofd/structures';
import { baseInMemoryFilterCompilers, compileToInMemoryFilter, createInMemoryFilterCompiler, EmailRecipient, Replacement } from '@stamhoofd/structures';
import { PaginatedResponse } from '@stamhoofd/structures';
import { EmailRecipientFilterType } from '@stamhoofd/structures/email/EmailRecipientFilterType.js';
import { GetOrganizationsEndpoint } from '../endpoints/admin/organizations/GetOrganizationsEndpoint.js';

function userToFilterableAdmin(user: User, platform: PlatformStruct, organization: Organization) {
    return {
        id: user.id,
        permissions: user.permissions?.forOrganization(organization, platform),
    };
}
const filterableAdminFilterCompilers: InMemoryFilterDefinitions = {
    ...baseInMemoryFilterCompilers,
    permissions: createInMemoryFilterCompiler(['permissions'], {
        ...baseInMemoryFilterCompilers,
        level: createInMemoryFilterCompiler('level'),
        accessRights: createInMemoryFilterCompiler('accessRights'),
    }),
};

Email.recipientLoaders.set(EmailRecipientFilterType.Organizations, {
    fetch: fetchRecipients,

    count: async (query: LimitedFilteredRequest, subfilter: StamhoofdFilter | null) => {
        const q = await GetOrganizationsEndpoint.buildQuery(query);
        const base = await q.count();

        if (base < 100) {
            // Do full scan
            query.limit = 100;
            const result = await fetchRecipients(query, subfilter);
            return result.results.length;
        }

        return base;
    },
});

async function fetchRecipients(query: LimitedFilteredRequest, subfilter: StamhoofdFilter | null) {
    const result = await GetOrganizationsEndpoint.buildModels(query);
    const compiledFilter = compileToInMemoryFilter(subfilter, filterableAdminFilterCompilers);
    const platform = await Platform.getSharedStruct();

    // Map recipients to admins
    const recipients: EmailRecipient[] = [];
    for (const organization of result.results) {
        // todo: filter admins
        const users = await organization.getAdmins();
        const filteredUsers = users.filter((user) => {
            const filterable = userToFilterableAdmin(user, platform, organization);
            return compiledFilter(filterable);
        });

        recipients.push(
            ...organization.adminsToRecipients(filteredUsers).map((r) => {
                return EmailRecipient.create({
                    ...r,
                    replacements: [
                        ...r.replacements,
                        Replacement.create({
                            token: 'organizationName',
                            value: organization.name,
                        }),
                    ],
                });
            }),
        );
    }

    return new PaginatedResponse({
        results: recipients,
        next: result.next,
    });
}
