import { BalanceItem, Member, Organization, User } from '@stamhoofd/models';
import { AuditLogReplacement, AuditLogReplacementType, AuditLogType, getBalanceItemTypeName } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { getDefaultGenerator, ModelLogger } from './ModelLogger.js';

const defaultGenerator = getDefaultGenerator({
    created: AuditLogType.BalanceItemAdded,
    updated: AuditLogType.BalanceItemEdited,
    deleted: AuditLogType.BalanceItemDeleted,
});

async function getPayerReplacement(model: BalanceItem): Promise<AuditLogReplacement | undefined> {
    if (model.memberId) {
        const member = await Member.getByID(model.memberId);
        if (member) {
            return AuditLogReplacement.create({
                id: member.id,
                value: member.details.name,
                type: AuditLogReplacementType.Member,
            });
        }
    }

    if (model.userId) {
        const user = await User.getByID(model.userId);
        if (user) {
            return AuditLogReplacement.create({
                id: user.id,
                value: user.email,
                type: AuditLogReplacementType.User,
            });
        }
    }

    if (model.payingOrganizationId) {
        const organization = await Organization.getByID(model.payingOrganizationId);
        if (organization) {
            return AuditLogReplacement.create({
                id: organization.id,
                value: organization.name,
                type: AuditLogReplacementType.Organization,
            });
        }
    }
}

export const BalanceItemLogger = new ModelLogger(BalanceItem, {
    // Cached values that follow from payments, not from edits
    skipKeys: ['priceTotal', 'pricePaid', 'pricePending', 'priceOpen', 'priceInvoiced', 'paidAt', 'failedAt'],

    async optionsGenerator(event) {
        const result = await defaultGenerator(event);

        if (!result) {
            return;
        }

        const payer = await getPayerReplacement(event.model);
        if (!payer) {
            console.log('No payer found for BalanceItem', event.model.id);
            return;
        }

        return {
            ...result,
            data: { payer },
        };
    },

    generateDescription(event) {
        if (event.type === 'created') {
            return `Type: ${getBalanceItemTypeName(event.model.type)}\nBedrag: ${Formatter.price(event.model.price)}`;
        }
    },

    createReplacements(model, options) {
        return new Map([
            ['b', AuditLogReplacement.create({
                id: model.id,
                value: model.description || getBalanceItemTypeName(model.type),
                type: AuditLogReplacementType.BalanceItem,
            })],
            ['payer', options.data.payer],
        ]);
    },
});
