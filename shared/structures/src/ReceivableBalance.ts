import { AnyDecoder, ArrayDecoder, AutoEncoder, EnumDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';
import { TranslateMethod } from './I18nInterface.js';
import { BalanceItemWithPayments } from './BalanceItem.js';
import { PaymentGeneral } from './members/PaymentGeneral.js';
import { Sorter } from '@stamhoofd/utility';

export enum ReceivableBalanceType {
    organization = 'organization',
    member = 'member',
    user = 'user',
}

export function getReceivableBalanceTypeName(type: ReceivableBalanceType, $t: TranslateMethod): string {
    switch (type) {
        case ReceivableBalanceType.organization: return $t('b66501e0-f6de-4259-95ef-13590b24182b');
        case ReceivableBalanceType.member: return $t('146d0874-2f4d-4374-8808-61a4bd953354');
        case ReceivableBalanceType.user: return $t('fbb0dee5-c500-4bb4-81d6-945666ae4784');
    }
}

export class ReceivableBalanceObjectContact extends AutoEncoder {
    @field({ decoder: StringDecoder, nullable: true })
    firstName: string | null = null;

    @field({ decoder: StringDecoder, nullable: true })
    lastName: string | null = null;

    @field({ decoder: new ArrayDecoder(StringDecoder) })
    emails: string[] = [];

    /**
     * Meta data that is used for filtering who to email
     */
    @field({ decoder: AnyDecoder, nullable: true, version: 346 })
    meta: any = null;
}

export class ReceivableBalanceObject extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    name = '';

    // E-mail addresses to reach out to this entity
    @field({ decoder: new ArrayDecoder(ReceivableBalanceObjectContact) })
    contacts: ReceivableBalanceObjectContact[] = [];
}

/**
 * An entity (organization, member or user) that has an outstanding balance towards an organization
 */
export class ReceivableBalance extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: new EnumDecoder(ReceivableBalanceType) })
    objectType: ReceivableBalanceType;

    @field({ decoder: ReceivableBalanceObject })
    object: ReceivableBalanceObject;

    /**
     * The organization that should receive the outstanding balance
     */
    @field({ decoder: StringDecoder })
    organizationId: string;

    @field({ decoder: IntegerDecoder })
    amount = 0;

    @field({ decoder: IntegerDecoder })
    amountPending = 0;

    get amountOpen() {
        return this.amount - this.amountPending;
    }
}

export class DetailedReceivableBalance extends ReceivableBalance {
    @field({ decoder: new ArrayDecoder(BalanceItemWithPayments) })
    balanceItems: BalanceItemWithPayments[] = [];

    @field({ decoder: new ArrayDecoder(PaymentGeneral) })
    payments: PaymentGeneral[] = [];

    get filteredBalanceItems() {
        return this.balanceItems.filter(i => BalanceItemWithPayments.getOutstandingBalance([i]).priceOpen !== 0).sort((a, b) => Sorter.stack(
            Sorter.byDateValue(b.dueAt ?? new Date(0), a.dueAt ?? new Date(0)),
            Sorter.byDateValue(b.createdAt, a.createdAt),
        ));
    }
}
