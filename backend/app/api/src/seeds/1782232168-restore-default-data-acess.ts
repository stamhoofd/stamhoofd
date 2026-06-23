import { Migration } from '@simonbackx/simple-database';
import { Organization } from '@stamhoofd/models';
import { AccessRight, PermissionLevel, PermissionRoleDetailed, PermissionsResourceType, ResourcePermissions } from '@stamhoofd/structures';
import { SeedTools } from '../helpers/SeedTools.js';

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    if (STAMHOOFD.platformName.toLowerCase() !== 'stamhoofd') {
        console.log('skipped for platform (only runs for Stamhoofd): ' + STAMHOOFD.platformName);
        return;
    }

    if (STAMHOOFD.userMode !== 'organization') {
        return;
    }

    if (STAMHOOFD.environment !== 'production') {
        return;
    }

    await start();
});

async function start() {
    await SeedTools.loop({
        query: Organization.select(),
        batchSize: 50,
        useTransactionPerBatch: true,
        action: async (organization: Organization) => {
            const base = PermissionRoleDetailed.create({
                level: PermissionLevel.None,
                accessRights: [],
            });

            if (organization.meta.packages.useMembers) {
                base.accessRights.push(
                    AccessRight.MemberWriteFinancialData,
                    AccessRight.MemberManageNRN,
                );
                base.resources.set(PermissionsResourceType.RecordCategories, new Map([
                    ['', ResourcePermissions.create({
                        level: PermissionLevel.Full,
                    })],
                ]));
            }

            // Senders
            base.resources.set(PermissionsResourceType.Senders, new Map([
                ['', ResourcePermissions.create({
                    level: PermissionLevel.None,
                    accessRights: [
                        AccessRight.SendMessages,
                    ],
                })],
            ]));

            for (const role of organization.privateMeta.roles) {
                role.add(base);
            }
            await organization.save();
        },
    });
}
