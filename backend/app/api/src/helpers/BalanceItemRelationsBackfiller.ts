import { BalanceItem, Group, Member, Order, Registration, Webshop } from '@stamhoofd/models';
import { SQL } from '@stamhoofd/sql';
import { BalanceItemRelation, BalanceItemRelationType, BalanceItemType, TranslatedString } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { SeedTools } from './SeedTools.js';

/**
 * Backfills the `relations` (and registration `startDate`/`endDate`) of legacy v1 balance items.
 *
 * V1 balance items were created without relations, so the frontend cannot show the member name, the
 * registration group, the working year or the webshop name (it falls back to "Onbekende
 * inschrijvingsgroep" / "Onbekende webshop"). We reconstruct that data from the linked registration or
 * order.
 *
 * Only balance items that still have empty relations are touched, so the migration is idempotent and
 * never overwrites relations that were already set by the current flows.
 */

/**
 * Build the relations for a registration balance item, mirroring RegisterMembersEndpoint.
 * Returns null when the linked registration/group/member can no longer be resolved.
 */
function buildRegistrationRelations(registration: Registration, group: Group, member: Member | undefined): Map<BalanceItemRelationType, BalanceItemRelation> {
    const relations = new Map<BalanceItemRelationType, BalanceItemRelation>();

    if (member) {
        relations.set(BalanceItemRelationType.Member, BalanceItemRelation.create({
            id: member.id,
            name: new TranslatedString(member.details.name),
        }));
    }

    relations.set(BalanceItemRelationType.Group, BalanceItemRelation.create({
        id: group.id,
        name: group.settings.name,
    }));

    // Mirror RegisterMembersEndpoint: only add the group price relation when there are multiple prices.
    if (group.settings.prices.length > 1 && registration.groupPrice) {
        relations.set(BalanceItemRelationType.GroupPrice, BalanceItemRelation.create({
            id: registration.groupPrice.id,
            name: registration.groupPrice.name,
        }));
    }

    return relations;
}

async function backfillRegistrationBalanceItems(): Promise<number> {
    let updated = 0;

    await SeedTools.loopBatched({
        batchSize: 100,
        query: BalanceItem.select()
            .whereNot('registrationId', null)
            .where(SQL.jsonLength(SQL.column('relations'), '$.value'), 0),
        batchAction: async (items: BalanceItem[]) => {
            const registrationIds = Formatter.uniqueArray(items.map(i => i.registrationId!).filter(id => !!id));
            const registrations = await Registration.getByIDs(...registrationIds);
            const registrationMap = new Map(registrations.map(r => [r.id, r]));

            const groups = await Group.getByIDs(...Formatter.uniqueArray(registrations.map(r => r.groupId)));
            const groupMap = new Map(groups.map(g => [g.id, g]));

            const members = await Member.getByIDs(...Formatter.uniqueArray(registrations.map(r => r.memberId)));
            const memberMap = new Map(members.map(m => [m.id, m]));

            for (const item of items) {
                // A second safety check: never overwrite existing relations.
                if (item.relations.size > 0) {
                    continue;
                }

                const registration = registrationMap.get(item.registrationId!);
                if (!registration) {
                    continue;
                }

                const group = groupMap.get(registration.groupId);
                if (!group) {
                    continue;
                }

                const member = memberMap.get(registration.memberId);

                item.relations = buildRegistrationRelations(registration, group, member);

                // Reconstruct the period (working year) so the frontend can show it.
                if (item.startDate === null && registration.startDate) {
                    item.startDate = registration.startDate;
                }
                if (item.endDate === null && registration.endDate) {
                    item.endDate = registration.endDate;
                }

                await item.save();
                updated += 1;
            }
        },
    });

    return updated;
}

async function backfillOrderBalanceItems(): Promise<number> {
    let updated = 0;

    await SeedTools.loopBatched({
        batchSize: 100,
        query: BalanceItem.select()
            .where('type', BalanceItemType.Order)
            .whereNot('orderId', null)
            .where(SQL.jsonLength(SQL.column('relations'), '$.value'), 0),
        batchAction: async (items: BalanceItem[]) => {
            const orderIds = Formatter.uniqueArray(items.map(i => i.orderId!).filter(id => !!id));
            const orders = await Order.getByIDs(...orderIds);
            const orderMap = new Map(orders.map(o => [o.id, o]));

            const webshops = await Webshop.getByIDs(...Formatter.uniqueArray(orders.map(o => o.webshopId)));
            const webshopMap = new Map(webshops.map(w => [w.id, w]));

            for (const item of items) {
                if (item.relations.size > 0) {
                    continue;
                }

                const order = orderMap.get(item.orderId!);
                if (!order) {
                    continue;
                }

                const webshop = webshopMap.get(order.webshopId);
                if (!webshop) {
                    continue;
                }

                item.relations = new Map([
                    [
                        BalanceItemRelationType.Webshop,
                        BalanceItemRelation.create({
                            id: webshop.id,
                            name: new TranslatedString(webshop.meta.name),
                        }),
                    ],
                ]);

                await item.save();
                updated += 1;
            }
        },
    });

    return updated;
}

export async function backfillBalanceItemRelations(): Promise<{ registrations: number; orders: number }> {
    const registrations = await backfillRegistrationBalanceItems();
    const orders = await backfillOrderBalanceItems();

    console.log(`[BalanceItemRelationsBackfiller] Updated ${registrations} registration balance items and ${orders} order balance items`);

    return { registrations, orders };
}
