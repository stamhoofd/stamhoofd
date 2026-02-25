import { Member, MemberPlatformMembership, Platform } from '@stamhoofd/models';
import { AuditLogReplacement, AuditLogReplacementType, AuditLogType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { getDefaultGenerator, ModelLogger } from './ModelLogger.js';

const defaultGenerator = getDefaultGenerator({
    created: AuditLogType.MemberPlatformMembershipAdded,
    updated: AuditLogType.MemberPlatformMembershipEdited,
    deleted: AuditLogType.MemberPlatformMembershipDeleted,
});

export const MemberPlatformMembershipLogger = new ModelLogger(MemberPlatformMembership, {
    skipKeys: ['balanceItemId', 'priceWithoutDiscount', 'maximumFreeAmount', 'generated'],
    async optionsGenerator(event) {
        const result = await defaultGenerator(event);

        if (!result) {
            return;
        }

        const member = await Member.getByID(event.model.memberId);

        if (!member) {
            console.log('No member found for MemberPlatformMembership', event.model.id);
            return;
        }

        return {
            ...result,
            data: {
                member,
                platform: await Platform.getSharedStruct(),
            },
            objectId: event.model.memberId,
        };
    },

    generateDescription(event, options) {
        return Formatter.capitalizeFirstLetter(Formatter.dateRange(event.model.startDate, event.model.endDate));
    },

    createReplacements(model, options) {
        const name = options.data.platform.config.membershipTypes.find(r => r.id === model.membershipTypeId)?.name;

        const map = new Map([
            ['pm', AuditLogReplacement.create({
                id: model.membershipTypeId,
                value: name,
                type: AuditLogReplacementType.PlatformMembershipType,
            })],
            ['m', AuditLogReplacement.create({
                id: options.data.member.id,
                value: options.data.member.details.name,
                type: AuditLogReplacementType.Member,
            })],
        ]);

        return map;
    },
});
