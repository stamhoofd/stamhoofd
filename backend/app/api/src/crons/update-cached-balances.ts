import { CachedBalance } from '@stamhoofd/models';
import { registerCron } from '@stamhoofd/crons';

registerCron('updateCachedBalances', updateCachedBalances);

async function updateCachedBalances() {
    // Check if between 3 - 6 AM
    if ((new Date().getHours() > 6 || new Date().getHours() < 3) && STAMHOOFD.environment !== 'development') {
        console.log('Not between 3 and 6 AM, skipping.');
        return;
    }

    const balances = await CachedBalance.select().where(
        CachedBalance.whereNeedsUpdate(),
    ).limit(100).fetch();

    // Group by object type and by organization id
    const grouped = new Map<string, CachedBalance[]>();

    for (const balance of balances) {
        const key = balance.objectType + '-' + balance.organizationId;
        const arr = grouped.get(key);

        if (!arr) {
            grouped.set(key, [balance]);
            continue;
        }

        arr.push(balance);
    }

    for (const [_, balances] of grouped) {
        const balance = balances[0];

        const ids = balances.map(b => b.objectId);
        console.log('Updating', ids.length, balance.objectType, 'for', balance.organizationId);
        await CachedBalance.updateForObjects(balance.organizationId, ids, balance.objectType);
    }
}
