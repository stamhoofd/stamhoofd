import { registerCron } from '@stamhoofd/crons';
import { Organization, Platform, STPackage } from '@stamhoofd/models';
import { useSavedIterator } from './helpers/useSavedIterator.js';
import { STPackageService } from '../services/STPackageService.js';
import { BalanceItemStatus } from '@stamhoofd/structures';

// Charge manual service fees every night
registerCron('members-fees', chargeMembers);

const { iterate, isHoursAgo } = useSavedIterator(() => {
    return Organization.select();
}, { limit: 10, maxQueries: 5 });

async function chargeMembers() {
    if (STAMHOOFD.environment !== 'development' && (new Date().getHours() > 5 || new Date().getHours() < 2)) {
        return;
    }

    if (!isHoursAgo(12)) {
        return;
    }

    const membershipOrganizationId = (await Platform.getShared()).membershipOrganizationId;
    if (!membershipOrganizationId) {
        return;
    }

    const membershipOrganization = await Organization.getByID(membershipOrganizationId, true);

    for await (const organization of iterate()) {
        await createItems(organization, membershipOrganization);
    }
}

async function createItems(organization: Organization, sellingOrganization: Organization) {
    const packages = await STPackageService.getActivePackages(organization.id);

    for (const pack of packages) {
        const item = await STPackageService.chargePackage(pack, sellingOrganization, organization.defaultCompanies[0]);
        if (item) {
            item.status = BalanceItemStatus.Due;
            await item.save();
            console.log('Charged', item.id);
        }
    }
}
