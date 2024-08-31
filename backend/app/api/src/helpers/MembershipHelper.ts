import { logger } from '@simonbackx/simple-logging';
import { Member } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';

export class MembershipHelper {
    static async updateAll() {
        console.log('Scheduling updateAllMemberships');

        let c = 0;
        let id: string = '';
        const tag = "updateAllMemberships";
        const batch = 100;

        QueueHandler.cancel(tag);

        await QueueHandler.schedule(tag, async () => {
            console.log('Starting updateAllMemberships');
            await logger.setContext({tags: ['silent-seed', 'seed']}, async () => {
                while(true) {
                    const rawMembers = await Member.where({
                        id: {
                            value: id,
                            sign: '>'
                        }
                    }, {limit: batch, sort: ['id']});

                    if (rawMembers.length === 0) {
                        break;
                    }

                    const promises: Promise<any>[] = [];
                    

                    for (const member of rawMembers) {
                        promises.push((async () => {
                            await Member.updateMembershipsForId(member.id, true);
                            c++;
                
                            if (c%10000 === 0) {
                                process.stdout.write(c + ' members updated\n');
                            }
                        })())
                    }

                    await Promise.all(promises);
                    id = rawMembers[rawMembers.length - 1].id;

                    if (rawMembers.length < batch) {
                        break;
                    }
                }
            })
        })
    }
}
