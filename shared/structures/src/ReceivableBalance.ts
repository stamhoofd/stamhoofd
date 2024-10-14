import { ArrayDecoder, AutoEncoder, EnumDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';
import { TranslateMethod } from './I18nInterface';
import { BalanceItemWithPayments } from './BalanceItem';
import { PaymentGeneral } from './members/PaymentGeneral';

export enum ReceivableBalanceType {
    organization = 'organization',
    member = 'member',
    user = 'user',
}

export function getReceivableBalanceTypeName(type: ReceivableBalanceType, $t: TranslateMethod): string {
    switch (type) {
        case ReceivableBalanceType.organization: return $t('vereniging');
        case ReceivableBalanceType.member: return $t('lid');
        case ReceivableBalanceType.user: return $t('account');
    }
}

export class ReceivableBalanceObjectContact extends AutoEncoder {
    @field({ decoder: StringDecoder, nullable: true })
    firstName: string | null = null;

    @field({ decoder: StringDecoder, nullable: true })
    lastName: string | null = null;

    @field({ decoder: new ArrayDecoder(StringDecoder) })
    emails: string[] = [];
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
}
