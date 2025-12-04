import { BalanceItem } from '@stamhoofd/models';
import { BalanceItemType, MemberWithRegistrationsBlob } from '@stamhoofd/structures';

export class MemberCharger {
    static async chargeMany({ chargingOrganizationId, membersToCharge, price, amount, description, dueAt, createdAt }: { chargingOrganizationId: string; membersToCharge: MemberWithRegistrationsBlob[]; price: number; amount?: number; description: string; dueAt: Date | null; createdAt: Date | null }) {
        await Promise.all(membersToCharge.map(memberToCharge => MemberCharger.charge({
            price,
            amount,
            description,
            chargingOrganizationId,
            memberToCharge,
            dueAt,
            createdAt,
        })));
    }

    static async charge({ chargingOrganizationId, memberToCharge, price, amount, description, dueAt, createdAt }: { chargingOrganizationId: string; memberToCharge: MemberWithRegistrationsBlob; price: number; amount?: number; description: string; dueAt: Date | null; createdAt: Date | null }) {
        const balanceItem = MemberCharger.createBalanceItem({
            price,
            amount,
            description,
            chargingOrganizationId,
            memberBeingCharged: memberToCharge,
            dueAt,
            createdAt,
        });

        await balanceItem.save();
    }

    private static createBalanceItem({ price, amount, description, chargingOrganizationId, memberBeingCharged, dueAt, createdAt }: { price: number; amount?: number; description: string; chargingOrganizationId: string; memberBeingCharged: MemberWithRegistrationsBlob; dueAt: Date | null; createdAt: Date | null }): BalanceItem {
        const balanceItem = new BalanceItem();
        balanceItem.unitPrice = price;
        balanceItem.amount = amount ?? 1;
        balanceItem.description = description;
        balanceItem.type = BalanceItemType.Other;
        balanceItem.memberId = memberBeingCharged.id;
        balanceItem.organizationId = chargingOrganizationId;
        balanceItem.dueAt = dueAt;
        if (createdAt !== null) {
            balanceItem.createdAt = createdAt;
        }

        return balanceItem;
    }
}
