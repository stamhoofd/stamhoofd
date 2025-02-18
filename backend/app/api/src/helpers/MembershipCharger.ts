import { SimpleError } from '@simonbackx/simple-errors';
import { BalanceItem, Member, MemberPlatformMembership, Platform } from '@stamhoofd/models';
import { SQL, SQLOrderBy, SQLWhereSign } from '@stamhoofd/sql';
import { BalanceItemRelation, BalanceItemRelationType, BalanceItemType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { BalanceItemService } from '../services/BalanceItemService';

export const MembershipCharger = {
    async charge() {
        console.log('Charging memberships...');

        // Loop all
        let lastId = '';
        const platform = await Platform.getShared();
        const chargeVia = platform.membershipOrganizationId;

        if (!chargeVia) {
            throw new SimpleError({
                code: 'missing_membership_organization',
                message: 'Missing membershipOrganizationId',
                human: 'Er is geen lokale groep verantwoordelijk voor de aanrekening van aansluitingen geconfigureerd',
            });
        }

        function getType(id: string) {
            return platform.config.membershipTypes.find(t => t.id === id);
        }

        let createdCount = 0;
        let createdPrice = 0;
        const chunkSize = 100;

        while (true) {
            const memberships = await MemberPlatformMembership.select()
                .where('id', SQLWhereSign.Greater, lastId)
                .where('balanceItemId', null)
                .where('deletedAt', null)
                .where('locked', false)
                .where(SQL.where('trialUntil', null).or('trialUntil', SQLWhereSign.LessEqual, new Date()))
                .limit(chunkSize)
                .orderBy(
                    new SQLOrderBy({
                        column: SQL.column('id'),
                        direction: 'ASC',
                    }),
                )
                .fetch();

            if (memberships.length === 0) {
                break;
            }

            const memberIds = Formatter.uniqueArray(memberships.map(m => m.memberId));
            const members = await Member.getByIDs(...memberIds);
            const createdBalanceItems: BalanceItem[] = [];

            for (const membership of memberships) {
                // charge
                if (membership.balanceItemId) {
                    continue;
                }

                const type = getType(membership.membershipTypeId);
                if (!type) {
                    console.error('Unknown membership type id ', membership.membershipTypeId);
                    continue;
                }

                const member = members.find(m => m.id === membership.memberId);

                if (!member) {
                    console.error('Unexpected missing member id ', membership.memberId, 'for membership', membership.id);
                    continue;
                }

                // Force price update (required because could have changed - especially for free memberships in combination with deletes)
                try {
                    await membership.calculatePrice(member);
                }
                catch (e) {
                    console.error('Failed to update price for membership. Not charged.', membership.id, e);
                    continue;
                }

                // Lock membership
                membership.locked = true;

                if (membership.organizationId === chargeVia) {
                    // Do not charge
                    await membership.save();
                    continue;
                }

                const balanceItem = new BalanceItem();
                balanceItem.unitPrice = membership.price;
                balanceItem.amount = 1;
                balanceItem.description = Formatter.dateNumber(membership.startDate, true) + ' tot ' + Formatter.dateNumber(membership.expireDate ?? membership.endDate, true);
                balanceItem.relations = new Map([
                    [
                        BalanceItemRelationType.Member,
                        BalanceItemRelation.create({
                            id: member.id,
                            name: member.details.name,
                        }),
                    ],
                    [
                        BalanceItemRelationType.MembershipType,
                        BalanceItemRelation.create({
                            id: type.id,
                            name: type.name,
                        }),
                    ],
                ]);

                balanceItem.type = BalanceItemType.PlatformMembership;
                balanceItem.organizationId = chargeVia;
                balanceItem.payingOrganizationId = membership.organizationId;

                await balanceItem.save();
                membership.balanceItemId = balanceItem.id;
                membership.maximumFreeAmount = membership.freeAmount;
                await membership.save();

                createdBalanceItems.push(balanceItem);

                createdCount += 1;
                createdPrice += membership.price;
            }

            await BalanceItem.updateOutstanding(createdBalanceItems);

            // Reallocate
            await BalanceItemService.reallocate(createdBalanceItems, chargeVia);

            if (memberships.length < chunkSize) {
                break;
            }

            const z = lastId;
            lastId = memberships[memberships.length - 1].id;

            if (lastId === z) {
                throw new Error('Unexpected infinite loop found in MembershipCharger');
            }
        }

        console.log('Charged ' + Formatter.integer(createdCount) + '  memberships, for a total value of ' + Formatter.price(createdPrice));
    },

    async updatePrices(organizationId?: string) {
        console.log('Update prices...');

        // Loop all
        let lastId = '';
        let createdCount = 0;
        const chunkSize = 100;

        while (true) {
            const q = MemberPlatformMembership.select()
                .where('id', SQLWhereSign.Greater, lastId)
                .where('balanceItemId', null)
                .where('deletedAt', null)
                .where('locked', false);

            if (organizationId) {
                q.where('organizationId', organizationId);
            }

            const memberships = await q
                .limit(chunkSize)
                .orderBy(
                    new SQLOrderBy({
                        column: SQL.column('id'),
                        direction: 'ASC',
                    }),
                )
                .fetch();

            if (memberships.length === 0) {
                break;
            }

            const memberIds = Formatter.uniqueArray(memberships.map(m => m.memberId));
            const members = await Member.getByIDs(...memberIds);

            for (const membership of memberships) {
                const member = members.find(m => m.id === membership.memberId);

                if (!member) {
                    console.error('Unexpected missing member id ', membership.memberId, 'for membership', membership.id);
                    continue;
                }

                // Force price update (required because could have changed - especially for free memberships in combination with deletes)
                try {
                    await membership.calculatePrice(member);
                    await membership.save();
                }
                catch (e) {
                    console.error('Failed to update price for membership', membership.id, e);
                    continue;
                }
                console.log('Updated price for membership', membership.id, membership.price);
                createdCount += 1;
            }

            if (memberships.length < chunkSize) {
                break;
            }

            const z = lastId;
            lastId = memberships[memberships.length - 1].id;

            if (lastId === z) {
                throw new Error('Unexpected infinite loop found in MembershipCharger');
            }
        }

        console.log('Updated prices of ' + Formatter.integer(createdCount) + '  memberships');
    },
};
