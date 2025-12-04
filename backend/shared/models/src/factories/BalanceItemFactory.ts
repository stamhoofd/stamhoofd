import { Factory } from '@simonbackx/simple-database';

import { BalanceItemRelation, BalanceItemRelationType, BalanceItemStatus, BalanceItemType } from '@stamhoofd/structures';
import { BalanceItem } from '../models/index.js';

class Options {
    organizationId: string;
    memberId?: string | null;
    userId?: string | null;
    payingOrganizationId?: string | null;
    registrationId?: string | null;
    orderId?: string | null;
    dependingBalanceItemId?: string | null;
    type?: BalanceItemType;
    amount: number;
    unitPrice: number;
    pricePaid?: number;
    pricePending?: number;
    dueAt?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
    status?: BalanceItemStatus;
    relations?: Map<BalanceItemRelationType, BalanceItemRelation>;
    description?: string;
}

export class BalanceItemFactory extends Factory<Options, BalanceItem> {
    async create(): Promise<BalanceItem> {
        const balanceItem = new BalanceItem();
        balanceItem.organizationId = this.options.organizationId;
        balanceItem.memberId = this.options.memberId ?? null;
        balanceItem.userId = this.options.userId ?? null;
        balanceItem.payingOrganizationId = this.options.payingOrganizationId ?? null;
        balanceItem.registrationId = this.options.registrationId ?? null;
        balanceItem.orderId = this.options.orderId ?? null;
        balanceItem.dependingBalanceItemId = this.options.dependingBalanceItemId ?? null;
        balanceItem.relations = this.options.relations ?? new Map();
        balanceItem.description = this.options.description ?? '';

        if (this.options.type) {
            balanceItem.type = this.options.type;
        }

        balanceItem.amount = this.options.amount;
        balanceItem.unitPrice = this.options.unitPrice;
        balanceItem.pricePaid = this.options.pricePaid ?? 0;
        balanceItem.pricePending = this.options.pricePending ?? 0;

        balanceItem.dueAt = this.options.dueAt ?? null;

        if (this.options.createdAt) {
            balanceItem.createdAt = this.options.createdAt;
        }

        if (this.options.updatedAt) {
            balanceItem.updatedAt = this.options.updatedAt;
        }
        balanceItem.status = this.options.status ?? BalanceItemStatus.Due;

        await balanceItem.save();

        // await BalanceItem.updateOutstanding([balanceItem]);
        return balanceItem;
    }
}
