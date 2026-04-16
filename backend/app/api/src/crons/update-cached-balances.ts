import { registerCron } from '@stamhoofd/crons';
import { CachedBalance } from '@stamhoofd/models';
import { ReceivableBalanceType } from '@stamhoofd/structures';

registerCron('updateCachedBalances', updateCachedBalances);

async function updateCachedBalances() {
    // Check if between 3 - 6 AM
    if ((new Date().getHours() > 6 || new Date().getHours() < 3)) {
        return;
    }

    const balances = await CachedBalance.select().where(
        CachedBalance.whereNeedsUpdate(),
    )
    /**
     * Cached balances of member should be updated before the cached balances of the user
     * because the cached balances of the user are dependent on the cached balances of the member.
     */
    .orderBy('objectType', 'ASC')
    // minimize the number of queries when updating
    .orderBy('organizationId', 'ASC')
    .limit(100).fetch();

    // Group by object type, next by organization id
    const grouped = new Map<ReceivableBalanceType, Map<string, CachedBalance[]>>();

    for (const balance of balances) {
        const objectType = balance.objectType;
        let organizationMap = grouped.get(objectType);
        if (!organizationMap) {
            organizationMap = new Map<string, CachedBalance[]>();
            grouped.set(objectType, organizationMap);
        }

        const organizationId = balance.organizationId;
        const balances = organizationMap.get(organizationId);

        if (!balances) {
            organizationMap.set(organizationId, [balance]);
            continue;
        }

        balances.push(balance);
    }

    // update member balances first
    const objectTypeMemberFirst = Array.from(grouped.entries());
    objectTypeMemberFirst.sort((a, b) => {
        const aIsMember = a[0] === ReceivableBalanceType.member;
        const bIsMember = b[0] === ReceivableBalanceType.member;
        if (aIsMember && !bIsMember) return -1;
        if (!aIsMember && bIsMember) return 1;
        return 0; 
    });

    for (const [objectType, organizationMap] of objectTypeMemberFirst) {
        for (const [organizationId, balances] of organizationMap) {
            const ids = balances.map(b => b.objectId);
            console.log('Updating', ids.length, objectType, 'for', organizationId);
            await CachedBalance.updateForObjects(organizationId, ids, objectType);
        }
    }
}
