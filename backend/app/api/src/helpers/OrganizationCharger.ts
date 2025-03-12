import { SimpleError } from '@simonbackx/simple-errors';
import { BalanceItem, Platform } from '@stamhoofd/models';
import { BalanceItemType, Organization as OrganizationStruct } from '@stamhoofd/structures';
import { BalanceItemService } from '../services/BalanceItemService';

export class OrganizationCharger {
    static async chargeFromPlatform(args: { organizationsToCharge: OrganizationStruct[]; price: number; amount?: number; description: string; dueAt: Date | null; createdAt: Date | null }) {
        const platform = await Platform.getShared();

        const chargeVia = platform.membershipOrganizationId;

        if (!chargeVia) {
            throw new SimpleError({
                code: 'missing_membership_organization',
                message: 'Missing membershipOrganizationId',
                human: 'Er is geen lokale groep verantwoordelijk voor de aanrekening van aansluitingen geconfigureerd',
            });
        }

        await OrganizationCharger.chargeMany({ chargingOrganizationId: chargeVia, ...args });
    }

    static async chargeMany({ chargingOrganizationId, organizationsToCharge, price, amount, description, dueAt, createdAt }: { chargingOrganizationId: string; organizationsToCharge: OrganizationStruct[]; price: number; amount?: number; description: string; dueAt: Date | null; createdAt: Date | null }) {
        const balanceItems = organizationsToCharge.map(organizationBeingCharged => OrganizationCharger.createBalanceItem({
            price,
            amount,
            description,
            chargingOrganizationId,
            organizationBeingCharged,
            dueAt,
            createdAt,
        }));

        await Promise.all(balanceItems.map(balanceItem => balanceItem.save()));
        await BalanceItem.updateOutstanding(balanceItems);

        // Reallocate
        await BalanceItemService.reallocate(balanceItems, chargingOrganizationId);
    }

    private static createBalanceItem({ price, amount, description, chargingOrganizationId, organizationBeingCharged, dueAt, createdAt }: { price: number; amount?: number; description: string; chargingOrganizationId: string; organizationBeingCharged: OrganizationStruct; dueAt: Date | null; createdAt: Date | null }): BalanceItem {
        const balanceItem = new BalanceItem();
        balanceItem.unitPrice = price;
        balanceItem.amount = amount ?? 1;
        balanceItem.description = description;
        balanceItem.type = BalanceItemType.Other;
        balanceItem.payingOrganizationId = organizationBeingCharged.id;
        balanceItem.organizationId = chargingOrganizationId;
        balanceItem.dueAt = dueAt;
        if (createdAt !== null) {
            balanceItem.createdAt = createdAt;
        }

        return balanceItem;
    }
}
