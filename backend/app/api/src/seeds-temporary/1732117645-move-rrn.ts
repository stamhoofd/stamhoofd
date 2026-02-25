import { Migration } from '@simonbackx/simple-database';
import { Member } from '@stamhoofd/models';
import { MemberUserSyncer } from '../helpers/MemberUserSyncer.js';
import { logger } from '@simonbackx/simple-logging';

export default new Migration(async () => {
    if (STAMHOOFD.environment == 'test') {
        console.log('skipped in tests');
        return;
    }

    if (STAMHOOFD.userMode !== 'platform') {
        console.log('skipped seed update-membership because usermode not platform');
        return;
    }

    process.stdout.write('\n');
    let c = 0;
    let id: string = '';

    await logger.setContext({ tags: ['silent-seed', 'seed'] }, async () => {
        while (true) {
            const rawMembers = await Member.where({
                id: {
                    value: id,
                    sign: '>',
                },
            }, { limit: 500, sort: ['id'] });

            if (rawMembers.length === 0) {
                break;
            }

            const promises: Promise<any>[] = [];

            for (const member of rawMembers) {
                promises.push((async () => {
                    const idR = '2b7d8f1c-ce67-4612-880b-fb1fb19affbb';
                    const valR = member.details.recordAnswers.get(idR);

                    const idRS = 'd381acce-9603-4246-af62-f3ea5292eec7';
                    const valRS = member.details.recordAnswers.get(idRS);

                    let save = false;

                    if (valR && !member.details.nationalRegisterNumber) {
                        member.details.nationalRegisterNumber = valR.stringValue;
                        save = true;
                    }

                    if (valRS && member.details.parents.length > 0 && !member.details.parents.find(p => p.nationalRegisterNumber)) {
                        member.details.parents[0].nationalRegisterNumber = valRS.stringValue;
                        save = true;
                    }

                    if (save) {
                        await member.save();
                    }
                    c++;

                    if (c % 1000 === 0) {
                        process.stdout.write('.');
                    }
                    if (c % 10000 === 0) {
                        process.stdout.write('\n');
                    }
                })());
            }

            await Promise.all(promises);
            id = rawMembers[rawMembers.length - 1].id;
        }
    });

    // Do something here
    return Promise.resolve();
});
