import { BalanceItem } from '@stamhoofd/models';
import { BalanceItemType, Organization as OrganizationStruct } from '@stamhoofd/structures';
import { BalanceItemService } from '../services/BalanceItemService';

export class OrganizationCharger {
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
        // await BalanceItem.updateOutstanding(balanceItems);

        // Reallocate
        // await BalanceItemService.reallocate(balanceItems, chargingOrganizationId);
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
