import { BalanceItem } from '@stamhoofd/models';
import { BalanceItemService } from '../../src/services/BalanceItemService.js';

export async function assertBalances(
    selector:
        { user: { id: string | null } }
        | { member: { id: string | null } }
        | { organization: { id: string | null } }
        | { payingOrganization: { id: string | null } },
    balances: Partial<BalanceItem>[]) {
    await BalanceItemService.flushAll();

    // Fetch all user balances
    const q = BalanceItem.select();
    if ('user' in selector && selector.user.id) {
        q.where('userId', selector.user.id);
    }
    else if ('member' in selector && selector.member.id) {
        q.where('memberId', selector.member.id);
    }
    else if ('organization' in selector && selector.organization.id) {
        q.where('organizationId', selector.organization.id);
    }
    else if ('payingOrganization' in selector && selector.payingOrganization.id) {
        q.where('payingOrganizationId', selector.payingOrganization.id);
    }
    else {
        throw new Error('Selector must contain either user or member with an id');
    }

    const userBalances = await q.fetch();

    try {
        expect(userBalances).toIncludeAllMembers(balances.map(b => expect.objectContaining(b)));
    }
    catch (e) {
        // List all the balances that were found and the ones that were missing
        if (userBalances.length !== balances.length) {
            console.error('Difference in number of balances found:', userBalances.length, 'expected:', balances.length);
        }

        for (const expectedBalance of balances) {
            let found = false;
            for (const userBalance of userBalances) {
                try {
                    expect(userBalance).toEqual(expect.objectContaining(expectedBalance));
                    found = true;
                }
                catch (e) {
                    // ignore
                }
            }

            if (!found) {
                console.error('Expected balance not found:', expectedBalance);
            }
        }

        throw e;
    }
}
