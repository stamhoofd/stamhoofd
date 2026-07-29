import { AccessRight, PermissionLevel, PermissionRoleDetailed, Permissions } from '@stamhoofd/structures';
import { OrganizationFactory, UserFactory } from '@stamhoofd/models';
import { OrganizationAdminService } from './OrganizationAdminService.js';

describe('Organization admin recipients', () => {
    async function createOrganizationWithAdmins() {
        const financeRole = PermissionRoleDetailed.create({
            name: 'financial director',
            accessRights: [AccessRight.OrganizationFinanceDirector],
        });

        const organization = await new OrganizationFactory({ roles: [financeRole] }).create();

        const fullAdmin = await new UserFactory({
            organization,
            email: 'full-admin@example.com',
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();

        const financeAdmin = await new UserFactory({
            organization,
            email: 'finance-admin@example.com',
            permissions: Permissions.create({
                level: PermissionLevel.None,
                roles: [financeRole],
            }),
        }).create();

        return { organization, fullAdmin, financeAdmin };
    }

    test('The finance admin recipients include a financial director without full access', async () => {
        const { organization, fullAdmin, financeAdmin } = await createOrganizationWithAdmins();

        const emails = (await OrganizationAdminService.getFinanceAdminRecipients(organization)).map(r => r.email);

        expect(emails).toIncludeSameMembers([fullAdmin.email, financeAdmin.email]);
    });

    test('The regular admin recipients only include full admins', async () => {
        const { organization, fullAdmin } = await createOrganizationWithAdmins();

        const emails = (await OrganizationAdminService.getAdminRecipients(organization)).map(r => r.email);

        expect(emails).toIncludeSameMembers([fullAdmin.email]);
    });
});
