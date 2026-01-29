import { AnyDecoder, ArrayDecoder, AutoEncoder, DateDecoder, EnumDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';
import { BalanceItem, BalanceItemWithPayments } from './BalanceItem.js';
import { TranslateMethod } from './I18nInterface.js';
import { PaymentGeneral } from './members/PaymentGeneral.js';
import { upgradePriceFrom2To4DecimalPlaces } from './upgradePriceFrom2To4DecimalPlaces.js';
import { PaymentCustomer } from './PaymentCustomer.js';

export enum ReceivableBalanceType {
    organization = 'organization',
    member = 'member',
    user = 'user',
    registration = 'registration',
    userWithoutMembers = 'userWithoutMembers',
}

export function getReceivableBalanceTypeName(type: ReceivableBalanceType): string {
    switch (type) {
        case ReceivableBalanceType.organization: return $t('b66501e0-f6de-4259-95ef-13590b24182b');
        case ReceivableBalanceType.member: return $t('146d0874-2f4d-4374-8808-61a4bd953354');
        case ReceivableBalanceType.user: return $t('fbb0dee5-c500-4bb4-81d6-945666ae4784');
        case ReceivableBalanceType.registration: return $t('b4a0f9cb-ecd0-4f9b-bd28-9e4a6c8b1518');
        case ReceivableBalanceType.userWithoutMembers: return $t('fbb0dee5-c500-4bb4-81d6-945666ae4784');
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

    /**
     * Only used for organization type
     */
    @field({ decoder: StringDecoder, nullable: true, version: 362 })
    uri: string | null = null;

    // E-mail addresses to reach out to this entity
    @field({ decoder: new ArrayDecoder(ReceivableBalanceObjectContact) })
    contacts: ReceivableBalanceObjectContact[] = [];

    /**
     * Customer to use when creating new payments
     */
    @field({ decoder: new ArrayDecoder(PaymentCustomer), ...NextVersion })
    customers: PaymentCustomer[] = [];
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

    @field({ decoder: IntegerDecoder, version: 354 })
    @field({ ...upgradePriceFrom2To4DecimalPlaces })
    amountPaid = 0;

    @field({ decoder: IntegerDecoder, field: 'amount' })
    @field({ decoder: IntegerDecoder, version: 354 })
    @field({ ...upgradePriceFrom2To4DecimalPlaces })
    amountOpen = 0;

    @field({ decoder: IntegerDecoder })
    @field({ ...upgradePriceFrom2To4DecimalPlaces })
    amountPending = 0;

    @field({ decoder: DateDecoder, nullable: true, version: 355 })
    lastReminderEmail: Date | null = null;

    @field({ decoder: IntegerDecoder, version: 355 })
    @field({ ...upgradePriceFrom2To4DecimalPlaces })
    lastReminderAmountOpen = 0;

    @field({ decoder: IntegerDecoder, version: 355 })
    reminderEmailCount = 0;
}

export class DetailedReceivableBalance extends ReceivableBalance {
    @field({ decoder: new ArrayDecoder(BalanceItemWithPayments) })
    balanceItems: BalanceItemWithPayments[] = [];

    @field({ decoder: new ArrayDecoder(PaymentGeneral) })
    payments: PaymentGeneral[] = [];

    get filteredBalanceItems() {
        return BalanceItem.filterBalanceItems(this.balanceItems);
    }
}
