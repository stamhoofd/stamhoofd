import { BalanceItem, MemberPlatformMembership, Registration, RegistrationPeriod } from '@stamhoofd/models';
import { BalanceItemRelation, BalanceItemRelationType, BalanceItemType, TranslatedString } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { SeedTools } from './SeedTools.js';

/**
 * Backfills the `RegistrationPeriod` relation on existing balance items.
 *
 * The relation contains the name of the registration period (working year) connected to a registration
 * (or its options / bundle discount) and to a platform membership. It was added after these balance items
 * were created, so we reconstruct it from the linked registration or membership.
 *
 * Only balance items that don't have the relation yet are touched, so the migration is idempotent and never
 * overwrites relations that were already set by the current flows.
 */

/**
 * Loads the registration period relation once per periodId.
 */
class PeriodRelationCache {
    private cache = new Map<string, BalanceItemRelation | null>();

    async get(periodId: string): Promise<BalanceItemRelation | null> {
        if (this.cache.has(periodId)) {
            return this.cache.get(periodId)!;
        }

        const period = await RegistrationPeriod.getByID(periodId);
        const relation = period
            ? BalanceItemRelation.create({
                    id: period.id,
                    name: new TranslatedString(period.getBaseStructure().name),
                })
            : null;

        this.cache.set(periodId, relation);
        return relation;
    }
}

async function backfillRegistrationBalanceItems(cache: PeriodRelationCache): Promise<number> {
    let updated = 0;

    await SeedTools.loopBatched({
        batchSize: 100,
        query: BalanceItem.select().whereNot('registrationId', null),
        batchAction: async (items: BalanceItem[]) => {
            const registrationIds = Formatter.uniqueArray(items.map(i => i.registrationId!).filter(id => !!id));
            const registrations = await Registration.getByIDs(...registrationIds);
            const registrationMap = new Map(registrations.map(r => [r.id, r]));

            for (const item of items) {
                // Never overwrite a relation that is already set.
                if (item.relations.has(BalanceItemRelationType.RegistrationPeriod)) {
                    continue;
                }

                const registration = registrationMap.get(item.registrationId!);
                if (!registration) {
                    continue;
                }

                const relation = await cache.get(registration.periodId);
                if (!relation) {
                    continue;
                }

                item.relations.set(BalanceItemRelationType.RegistrationPeriod, relation);
                await item.save();
                updated += 1;
            }
        },
    });

    return updated;
}

async function backfillPlatformMembershipBalanceItems(cache: PeriodRelationCache): Promise<number> {
    let updated = 0;

    await SeedTools.loopBatched({
        batchSize: 100,
        query: BalanceItem.select().where('type', BalanceItemType.PlatformMembership),
        batchAction: async (items: BalanceItem[]) => {
            const balanceItemIds = items.map(i => i.id);
            const memberships = await MemberPlatformMembership.select()
                .where('balanceItemId', balanceItemIds)
                .limit(balanceItemIds.length)
                .fetch();
            const membershipByBalanceItemId = new Map(memberships.filter(m => m.balanceItemId).map(m => [m.balanceItemId!, m]));

            for (const item of items) {
                if (item.relations.has(BalanceItemRelationType.RegistrationPeriod)) {
                    continue;
                }

                const membership = membershipByBalanceItemId.get(item.id);
                if (!membership) {
                    continue;
                }

                const relation = await cache.get(membership.periodId);
                if (!relation) {
                    continue;
                }

                item.relations.set(BalanceItemRelationType.RegistrationPeriod, relation);
                await item.save();
                updated += 1;
            }
        },
    });

    return updated;
}

export async function backfillRegistrationPeriodRelations(): Promise<{ registrations: number; memberships: number }> {
    const cache = new PeriodRelationCache();
    const registrations = await backfillRegistrationBalanceItems(cache);
    const memberships = await backfillPlatformMembershipBalanceItems(cache);

    console.log(`[RegistrationPeriodRelationBackfiller] Updated ${registrations} registration balance items and ${memberships} platform membership balance items`);

    return { registrations, memberships };
}
