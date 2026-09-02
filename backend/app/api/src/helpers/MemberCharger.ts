import { BalanceItem } from '@stamhoofd/models';
import type { MemberWithRegistrationsBlob } from '@stamhoofd/structures';
import { BalanceItemType } from '@stamhoofd/structures';

export class MemberCharger {
    static async chargeMany({ chargingOrganizationId, membersToCharge, price, amount, name, description, dueAt, createdAt }: { chargingOrganizationId: string; membersToCharge: MemberWithRegistrationsBlob[]; price: number; amount?: number; name: string; description: string | null; dueAt: Date | null; createdAt: Date | null }) {
        await Promise.all(membersToCharge.map(memberToCharge => MemberCharger.charge({
            price,
            amount,
            name,
            description,
            chargingOrganizationId,
            memberToCharge,
            dueAt,
            createdAt,
        })));
    }

    static async charge({ chargingOrganizationId, memberToCharge, price, amount, name, description, dueAt, createdAt }: { chargingOrganizationId: string; memberToCharge: MemberWithRegistrationsBlob; price: number; amount?: number; name: string; description: string | null; dueAt: Date | null; createdAt: Date | null }) {
        const balanceItem = MemberCharger.createBalanceItem({
            price,
            amount,
            name,
            description,
            chargingOrganizationId,
            memberBeingCharged: memberToCharge,
            dueAt,
            createdAt,
        });

        await balanceItem.save();
    }

    private static createBalanceItem({ price, amount, name, description, chargingOrganizationId, memberBeingCharged, dueAt, createdAt }: { price: number; amount?: number; name: string; description: string | null; chargingOrganizationId: string; memberBeingCharged: MemberWithRegistrationsBlob; dueAt: Date | null; createdAt: Date | null }): BalanceItem {
        const balanceItem = new BalanceItem();
        balanceItem.unitPrice = price;
        balanceItem.amount = amount ?? 1;
        balanceItem.name = name;
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
