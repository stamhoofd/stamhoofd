import { Migration } from '@simonbackx/simple-database';
import { isSimpleError } from '@simonbackx/simple-errors';
import { logger } from '@simonbackx/simple-logging';
import { Member } from '@stamhoofd/models';
import { SQL } from '@stamhoofd/sql';
import { UitpasSocialTariff, UitpasSocialTariffStatus } from '@stamhoofd/structures';
import { sleep } from '@stamhoofd/utility';
import { updateMemberDetailsUitpasNumber } from '../../helpers/updateMemberDetailsUitpasNumber.js';

/**
 * Seed to update the social tariff of all uitpas numbers.
 * After the seed all uitpas numbers should have a status different than unknown, unless the number does not exist.
 */

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    if (STAMHOOFD.environment === 'development') {
        console.log('skipped in development');
        return;
    }

    process.stdout.write('\n');

    await logger.setContext({ tags: ['seed'] }, async () => {
        await migrateUitpasStatusOfAllMembers();
    });
});

let idOfLastUpdatedMember: string | null = null;

export async function migrateUitpasStatusOfAllMembers() {
    let query = Member.select()
    // where there is an uitpas number
        .where(SQL.jsonValue(SQL.column('details'), '$.value.uitpasNumberDetails'), '!=', null);

    if (idOfLastUpdatedMember !== null) {
        console.log('Continue from member with id ', idOfLastUpdatedMember);
        query = query.where('id', '>', idOfLastUpdatedMember);
    }
    console.log(`Start updating uitpas status members.`);

    let c = 0;

    for await (const member of query.all()) {
        await migrateMember(member);
        c++;

        if (c % 1000 === 0) {
            process.stdout.write(c + ' members updated\n');
        }

        // prevent rate limits
        await sleep(100);
    }
}

async function migrateMember(member: Member) {
    if (member.details.uitpasNumberDetails?.uitpasNumber === undefined) {
        console.error('Unexpected: uitpasNumber is undefined for member with id ', member.id);
        return;
    }

    try {
        await updateMemberDetailsUitpasNumber(member.details);
        member.details.cleanData();

        // remove the review if the social tariff is not active (all uitpas number were deemed active before the migration)
        if (member.details.uitpasNumberDetails.uitpasNumber && !member.details.uitpasNumberDetails?.isActive) {
            member.details.reviewTimes.removeReview('uitpasNumber');
        }

        await member.save();
        idOfLastUpdatedMember = member.id;
    }
    catch (error) {
        if (isSimpleError(error)) {
            // if rate limited
            if (error.statusCode === 429) {
                console.error('Rate limited, waiting 1 minute');
                // wait 1 minute and try again
                await sleep(60 * 1000);
                return await migrateMember(member);
            }

            // if the uitpas number is not known by the uitpas api
            if (error.hasCode('https://api.publiq.be/probs/uitpas/pass-not-found') || error.hasCode('https://api.publiq.be/probs/uitpas/invalid-uitpas-number')) {
                console.log(`Uitpas number ${member.details.uitpasNumberDetails?.uitpasNumber} is not known by the uitpas api for member with id ${member.id}.`);

                // set updated at
                if (member.details.uitpasNumberDetails) {
                    member.details.uitpasNumberDetails.socialTariff = UitpasSocialTariff.create({
                        status: UitpasSocialTariffStatus.Unknown,
                    });
                }

                // remove review
                member.details.reviewTimes.removeReview('uitpasNumber');
                await member.save();

                // do not throw
                return;
            }

            if (error.code === 'invalid_uitpas_number') {
                // Invalid syntax
                console.log(`Uitpas number ${member.details.uitpasNumberDetails?.uitpasNumber} is invalid. Remove uitpas number details for member with id ${member.id}.`);

                // remove the uitpas number
                member.details.uitpasNumberDetails = null;
                member.details.cleanData();
                await member.save();

                // do not throw
                return;
            }
        }

        console.error(error);

        throw error;
    }
}
