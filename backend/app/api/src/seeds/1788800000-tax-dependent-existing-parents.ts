import { Migration } from '@simonbackx/simple-database';
import { logger } from '@simonbackx/simple-logging';
import { Member } from '@stamhoofd/models';
import { NationalRegisterNumberOptOut } from '@stamhoofd/structures';
import { SeedTools } from '../helpers/SeedTools.js';

/**
 * Parents were asked for a national register number before it became tied to tax dependency.
 * Only one parent having one says unambiguously who the debtor is, which is the same parent
 * the document logic already picked. More than one is a choice the family has to make.
 */
export function markSingleTaxDependentParent(member: Member): boolean {
    const withNationalRegisterNumber = member.details.parents.filter(p => p.nationalRegisterNumber && p.nationalRegisterNumber !== NationalRegisterNumberOptOut);

    if (withNationalRegisterNumber.length !== 1) {
        return false;
    }

    const parent = withNationalRegisterNumber[0];

    if (parent.taxDependent !== null) {
        return false;
    }

    parent.taxDependent = true;
    return true;
}

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    let updated = 0;

    const result = await logger.setContext({ tags: ['silent-seed', 'seed'] }, async () => {
        return await SeedTools.loop({
            query: Member.select(),
            batchSize: 100,
            action: async (member) => {
                if (!markSingleTaxDependentParent(member)) {
                    return;
                }

                await member.save({
                    skipMarkSaved: true,
                    skipSendEvents: true,
                });
                updated++;
            },
        });
    });

    console.log('Marked a tax dependent parent for ' + updated + ' of ' + result.total + ' members');
});
