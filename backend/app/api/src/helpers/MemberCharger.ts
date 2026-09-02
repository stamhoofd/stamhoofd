import { BalanceItem } from '@stamhoofd/models';
import type { MemberWithRegistrationsBlob, VATExcemptReason } from '@stamhoofd/structures';
import { BalanceItemType } from '@stamhoofd/structures';

export class MemberCharger {
    static async chargeMany({ chargingOrganizationId, membersToCharge, price, amount, name, description, VATPercentage, VATIncluded, VATExcempt, dueAt, createdAt }: { chargingOrganizationId: string; membersToCharge: MemberWithRegistrationsBlob[]; price: number; amount?: number; name: string; description: string | null; VATPercentage: number | null; VATIncluded: boolean; VATExcempt: VATExcemptReason | null; dueAt: Date | null; createdAt: Date | null }) {
        await Promise.all(membersToCharge.map(memberToCharge => MemberCharger.charge({
            price,
            amount,
            name,
            description,
            VATPercentage,
            VATIncluded,
            VATExcempt,
            chargingOrganizationId,
            memberToCharge,
            dueAt,
            createdAt,
        })));
    }

    static async charge({ chargingOrganizationId, memberToCharge, price, amount, name, description, VATPercentage, VATIncluded, VATExcempt, dueAt, createdAt }: { chargingOrganizationId: string; memberToCharge: MemberWithRegistrationsBlob; price: number; amount?: number; name: string; description: string | null; VATPercentage: number | null; VATIncluded: boolean; VATExcempt: VATExcemptReason | null; dueAt: Date | null; createdAt: Date | null }) {
        const balanceItem = MemberCharger.createBalanceItem({
            price,
            amount,
            name,
            description,
            VATPercentage,
            VATIncluded,
            VATExcempt,
            chargingOrganizationId,
            memberBeingCharged: memberToCharge,
            dueAt,
            createdAt,
        });

        await balanceItem.save();
    }

    private static createBalanceItem({ price, amount, name, description, VATPercentage, VATIncluded, VATExcempt, chargingOrganizationId, memberBeingCharged, dueAt, createdAt }: { price: number; amount?: number; name: string; description: string | null; VATPercentage: number | null; VATIncluded: boolean; VATExcempt: VATExcemptReason | null; chargingOrganizationId: string; memberBeingCharged: MemberWithRegistrationsBlob; dueAt: Date | null; createdAt: Date | null }): BalanceItem {
        const balanceItem = new BalanceItem();
        balanceItem.unitPrice = price;
        balanceItem.amount = amount ?? 1;
        balanceItem.name = name;
        balanceItem.description = description;
        balanceItem.VATPercentage = VATPercentage;
        balanceItem.VATIncluded = VATIncluded;
        balanceItem.VATExcempt = VATExcempt;
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
