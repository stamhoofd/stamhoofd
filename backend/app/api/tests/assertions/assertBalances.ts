import { BalanceItem } from '@stamhoofd/models';

export async function assertBalances(selector: { user: { id: string | null } }, balances: Partial<BalanceItem>[]) {
    // Fetch all user balances
    const userBalances = await BalanceItem.select().where('userId', selector.user.id).fetch();

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
