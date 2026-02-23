import { ArrayDecoder, AutoEncoder, AutoEncoderPatchType, DateDecoder, EnumDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { Formatter } from '@stamhoofd/utility';

import { BalanceItemWithPayments, BalanceItemWithPrivatePayments } from '../BalanceItem.js';
import { EmailRecipient } from '../email/Email.js';
import { Recipient, Replacement } from '../endpoints/EmailRequest.js';
import { Payment, PrivatePayment } from '../members/Payment.js';
import { RecordCheckboxAnswer } from '../members/records/RecordAnswer.js';
import { RecordCategory } from '../members/records/RecordCategory.js';
import { Organization } from '../Organization.js';
import { downgradePaymentMethodV150, PaymentMethod, PaymentMethodHelper, PaymentMethodV150 } from '../PaymentMethod.js';
import { PaymentStatus } from '../PaymentStatus.js';
import { Checkout } from './Checkout.js';
import { Customer } from './Customer.js';
import { TicketPrivate } from './Ticket.js';
import { WebshopPreview } from './Webshop.js';
import { CheckoutMethodType, WebshopTakeoutMethod } from './WebshopMetaData.js';

export enum OrderStatusV103 {
    Created = 'Created',
    Prepared = 'Prepared',
    Completed = 'Completed',
    Canceled = 'Canceled',
}

export enum OrderStatusV137 {
    Created = 'Created',
    Prepared = 'Prepared',
    Collect = 'Collect',
    Completed = 'Completed',
    Canceled = 'Canceled',
}

export enum OrderStatus {
    Created = 'Created',
    Prepared = 'Prepared',
    Collect = 'Collect',
    Completed = 'Completed',
    Canceled = 'Canceled',
    Deleted = 'Deleted',
}

export class OrderStatusHelper {
    static getName(status: OrderStatus): string {
        switch (status) {
            case OrderStatus.Created: return $t(`e69989bf-c310-49b4-aff1-b9c84cfe5760`);
            case OrderStatus.Prepared: return $t(`a31b162c-b97b-48f5-b020-8152277f7522`);
            case OrderStatus.Collect: return $t(`cdeb4790-0e33-402d-9276-5f0e34873877`);
            case OrderStatus.Completed: return $t(`1e1637ef-4133-4f30-973d-bd913387961e`);
            case OrderStatus.Canceled: return $t(`72fece9f-e932-4463-9c2b-6e8b22a98f15`);
            case OrderStatus.Deleted: return $t(`fb738914-5429-4d24-9eac-564caa299996`);
        }
    }

    static getColor(status: OrderStatus): string {
        switch (status) {
            case OrderStatus.Completed: return 'success';
            case OrderStatus.Prepared: return 'secundary';
            case OrderStatus.Collect: return 'tertiary';
            case OrderStatus.Canceled: return 'error';
            case OrderStatus.Created: return 'info';
        }
        return 'error';
    }
}

export class OrderData extends Checkout {
    @field({ decoder: StringDecoder, version: 129 })
    consumerLanguage = 'nl';

    @field({ decoder: StringDecoder, version: 158 })
    comments = '';

    // Payment method is required
    @field({ decoder: new EnumDecoder(PaymentMethodV150) })
    @field({
        decoder: new EnumDecoder(PaymentMethod),
        version: 151,
        downgrade: downgradePaymentMethodV150,
    })
    paymentMethod: PaymentMethod = PaymentMethod.Unknown;

    get shouldSendPaymentUpdates() {
        return (!this.timeSlot || (this.timeSlot.date.getTime() + 1000 * 60 * 60 * 24) > new Date().getTime());
    }

    get locationName() {
        if (this.checkoutMethod?.type === CheckoutMethodType.Takeout) {
            return this.checkoutMethod.name;
        }

        if (this.checkoutMethod?.type === CheckoutMethodType.OnSite) {
            return this.checkoutMethod.name;
        }

        return this.address?.shortString() ?? $t(`49e90fda-d262-4fe7-a2e2-d6b48abc8e2b`);
    }

    /**
     * Delete the personal data associated with an order when you delete an order.
     * We still need the other data (e.g. to inform other clients about a deleted order)
     * And also to match online payments and handle refunds if needed
     */
    removePersonalData() {
        // Clear customer data
        this.customer = Customer.create({});

        // Clear free inputs
        this.fieldAnswers = [];

        for (const item of this.cart.items) {
            item.fieldAnswers = [];
        }

        this.recordAnswers = new Map();
    }
}

export class Order extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string;

    @field({ decoder: StringDecoder, version: 140 })
    webshopId: string;

    @field({ decoder: IntegerDecoder, nullable: true })
    number: number | null = null;

    @field({ decoder: OrderData })
    data: OrderData = OrderData.create({});

    @field({ decoder: new ArrayDecoder(BalanceItemWithPayments), version: 225 })
    balanceItems: BalanceItemWithPayments[] = [];

    /**
     * @deprecated: replaced by balance items
     */
    @field({ decoder: Payment, nullable: true })
    payment: Payment | null = null;

    @field({ decoder: DateDecoder })
    createdAt: Date = new Date();

    @field({ decoder: DateDecoder, version: 107 })
    updatedAt: Date = new Date();

    @field({ decoder: DateDecoder, nullable: true })
    validAt: Date | null = null;

    @field({ decoder: new EnumDecoder(OrderStatusV103), version: 47 })
    // Migrate newer order status .collect in case of older client
    @field({
        decoder: new EnumDecoder(OrderStatusV137),
        version: 104,
        upgrade: (old: OrderStatusV103): OrderStatusV137 => {
            return old as any as OrderStatusV137;
        },
        downgrade: (n: OrderStatusV137): OrderStatusV103 => {
            if (n === OrderStatusV137.Collect) {
                // Map to other status
                return OrderStatusV103.Prepared;
            }
            return n as any as OrderStatusV103;
        },
    })
    @field({
        decoder: new EnumDecoder(OrderStatus),
        version: 138,
        upgrade: (old: OrderStatusV137): OrderStatus => {
            return old as any as OrderStatus;
        },
        downgrade: (n: OrderStatus): OrderStatusV137 => {
            if (n === OrderStatus.Deleted) {
                // Map to other status
                return OrderStatusV137.Canceled;
            }
            return n as any as OrderStatusV137;
        },
    })
    status = OrderStatus.Created;

    get shouldIncludeStock() {
        return this.status !== OrderStatus.Canceled && this.status !== OrderStatus.Deleted;
    }

    get pricePaid() {
        return this.balanceItems.reduce((total, item) => total + item.pricePaid, 0);
    }

    get totalToPay() {
        if (this.status === OrderStatus.Canceled || this.status === OrderStatus.Deleted) {
            return 0;
        }
        return this.data.totalPrice;
    }

    get openBalance() {
        return this.totalToPay - this.pricePaid;
    }

    updatePricePaid() {
        for (const item of this.balanceItems) {
            item.updatePricePaid();
        }
    }

    get payments() {
        return this.balanceItems.flatMap(i => i.payments.map(p => p.payment)).filter(p => p.status !== PaymentStatus.Failed).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }

    get paidAt() {
        const time = Math.min(new Date(2100, 0, 1).getTime(), ...this.payments.map(p => (p.paidAt ?? new Date(2100, 0, 1)).getTime()));
        return new Date(time);
    }

    getHTMLTable(): string {
        const allFree = this.data.cart.items.every(i => i.getPriceWithoutDiscounts() === 0);

        if (allFree) {
            let str = `<table width="100%" cellspacing="0" cellpadding="0" class="email-data-table"><thead><tr><th>Artikel</th><th>Aantal</th></tr></thead><tbody>`;

            for (const item of this.data.cart.items) {
                str += `<tr><td><h4>${Formatter.escapeHtml(item.product.name)}</h4>${item.description.length > 0 ? '<p style="white-space: pre-wrap;">' + Formatter.escapeHtml(item.description) + '</p>' : ''}</td><td>${Formatter.escapeHtml(item.formattedAmount ?? '1')}</td></tr>`;
            }
            return str + '</tbody></table>';
        }

        let str = `<table width="100%" cellspacing="0" cellpadding="0" class="email-data-table"><thead><tr><th>Artikel</th><th>Aantal</th></tr></thead><tbody>`;

        for (const item of this.data.cart.items) {
            str += `<tr><td><h4>${Formatter.escapeHtml(item.product.name)}</h4>${item.description.length > 0 ? '<p style="white-space: pre-wrap;">' + Formatter.escapeHtml(item.description) + '</p>' : ''}${'<p style="white-space: pre-wrap;">' + Formatter.escapeHtml(item.getFormattedPriceWithDiscount() || item.getFormattedPriceWithoutDiscount()) + '</p>'}</td><td>${Formatter.escapeHtml(item.formattedAmount ?? '1')}</td></tr>`;
        }
        return str + '</tbody></table>';
    }

    getDetailsHTMLTable(webshop: WebshopPreview): string {
        let str = `<table width="100%" cellspacing="0" cellpadding="0" class="email-data-table"><tbody>`;

        const data = [
            {
                title: $t('4d496edf-0203-4df3-a6e9-3e58d226d6c5'),
                value: '' + (this.number ?? '?'),
            },
            {
                title: ((order) => {
                    if (order.data.checkoutMethod?.type === CheckoutMethodType.Takeout) {
                        return $t(`8113733b-00ea-42ae-8829-6056774a8be0`);
                    }

                    if (order.data.checkoutMethod?.type === CheckoutMethodType.OnSite) {
                        return $t(`7eec15d0-4d60-423f-b860-4f3824271578`);
                    }

                    return $t(`8a910c54-1b2d-4963-9128-2cab93b0151b`);
                })(this),
                value: ((order) => {
                    if (order.data.checkoutMethod?.type === CheckoutMethodType.Takeout) {
                        return order.data.checkoutMethod.name;
                    }

                    if (order.data.checkoutMethod?.type === CheckoutMethodType.OnSite) {
                        return order.data.checkoutMethod.name;
                    }

                    return order.data.address?.shortString() ?? '';
                })(this),
            },
            ...(
                (this.data.checkoutMethod?.type === CheckoutMethodType.Takeout || this.data.checkoutMethod?.type === CheckoutMethodType.OnSite) && ((this.data.checkoutMethod as any)?.address)
                    ? [
                            {
                                title: $t(`f7e792ed-2265-41e9-845f-e3ce0bc5da7c`),
                                value: ((order) => {
                                    return (order.data.checkoutMethod as WebshopTakeoutMethod)?.address?.shortString() ?? '';
                                })(this),
                            },
                        ]
                    : []
            ),
            {
                title: $t(`40aabd99-0331-4267-9b6a-a87c06b3f7fe`),
                value: Formatter.capitalizeFirstLetter(this.data.timeSlot?.dateString() ?? ''),
            },
            {
                title: $t(`7853cca1-c41a-4687-9502-190849405f76`),
                value: this.data.timeSlot?.timeRangeString() ?? '',
            },
            {
                title: $t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`),
                value: this.data.customer.name,
            },
            ...(this.data.customer.phone
                ? [
                        {
                            title: $t(`feea3664-9353-4bd4-b17d-aff005d3e265`),
                            value: this.data.customer.phone,
                        },
                    ]
                : []),
            ...this.data.fieldAnswers.filter(a => a.answer).map(a => ({
                title: a.field.name,
                value: a.answer,
            })),
            ...RecordCategory.sortAnswers(this.data.recordAnswers, webshop.meta.recordCategories).filter(a => !a.isEmpty || a instanceof RecordCheckboxAnswer).map(a => ({
                title: a.settings.name.toString(),
                value: a.stringValue,
            })),
            ...(
                (this.data.paymentMethod !== PaymentMethod.Unknown)
                    ? [
                            {
                                title: $t(`07e7025c-0bfb-41be-87bc-1023d297a1a2`),
                                value: Formatter.capitalizeFirstLetter(PaymentMethodHelper.getName(this.data.paymentMethod)),
                            },
                        ]
                    : []
            ),
            ...this.data.priceBreakown.map((p) => {
                return {
                    title: p.name,
                    value: Formatter.price(p.price),
                };
            }),
        ];

        for (const replacement of data) {
            if (replacement.value.length === 0) {
                continue;
            }
            str += `<tr><td><h4>${Formatter.escapeHtml(replacement.title)}</h4></td><td>${Formatter.escapeHtml(replacement.value)}</td></tr>`;
        }

        return str + '</tbody></table>';
    }

    getEmailRecipient(organization: Organization, webshop: WebshopPreview): EmailRecipient {
        const customer = this.data.customer;
        const email = customer.email.toLowerCase();

        return EmailRecipient.create({
            objectId: this.id,
            firstName: customer.firstName,
            lastName: customer.lastName,
            email,
            replacements: this.getRecipientReplacements(organization, webshop),
        });
    }

    getRecipient(organization: Organization, webshop: WebshopPreview, payment?: Payment) {
        const order = this;
        const email = order.data.customer.email.toLowerCase();

        return Recipient.create({
            firstName: order.data.customer.firstName,
            lastName: order.data.customer.lastName,
            email,
            replacements: this.getRecipientReplacements(organization, webshop, payment ? [payment] : order.payments),
        });
    }

    private getRecipientReplacements(organization: Organization, webshop: WebshopPreview, payments: Payment[] = this.payments) {
        const order = this;
        const succeededTransfers = payments
            .filter(p => p.status === PaymentStatus.Succeeded && p.method === PaymentMethod.Transfer) ?? payments.filter(p => p.method === PaymentMethod.Transfer);

        return [
            Replacement.create({
                token: 'orderUrl',
                value: 'https://' + webshop?.getUrl(organization) + '/order/' + (order.id),
            }),
            Replacement.create({
                token: 'nr',
                value: (order.number ?? '') + '',
            }),
            Replacement.create({
                token: 'orderPrice',
                value: Formatter.price(order.data.totalPrice),
            }),
            Replacement.create({
                token: 'priceToPay',
                value: order.openBalance <= 0 ? '' : Formatter.price(order.openBalance),
            }),
            Replacement.create({
                token: 'paymentMethod',
                value: order.data.paymentMethod,
            }),
            Replacement.create({
                token: 'transferDescription',
                value: succeededTransfers.map(p => p.transferDescription).join(', '),
            }),
            Replacement.create({
                token: 'transferBankAccount',
                value: succeededTransfers
                    .map(p => p.transferSettings?.iban ?? organization.meta.registrationPaymentConfiguration.transferSettings.iban)
                    .filter(iban => !!iban)
                    .join(', '),
            }),
            Replacement.create({
                token: 'transferBankCreditor',
                value: succeededTransfers
                    .map(p => p.transferSettings?.creditor ?? organization.meta.registrationPaymentConfiguration.transferSettings.creditor ?? organization.name)
                    .join(', '),
            }),
            Replacement.create({
                token: 'orderStatus',
                value: OrderStatusHelper.getName(order.status),
            }),
            Replacement.create({
                token: 'orderMethod',
                value: order.data.checkoutMethod?.typeName ?? '',
            }),
            Replacement.create({
                token: 'orderLocation',
                value: order.data.locationName,
            }),
            Replacement.create({
                token: 'orderDate',
                value: order.data.timeSlot?.dateString() ?? '',
            }),
            Replacement.create({
                token: 'orderTime',
                value: order.data.timeSlot?.timeRangeString() ?? '',
            }),
            Replacement.create({
                token: 'orderDetailsTable',
                value: '',
                html: order.getDetailsHTMLTable(webshop),
            }),
            Replacement.create({
                token: 'orderTable',
                value: '',
                html: order.getHTMLTable(),
            }),
            Replacement.create({
                token: 'paymentTable',
                value: '',
                html: order.payments.map(p => p.getHTMLTable()).join(),
            }),
            Replacement.create({
                token: 'organizationName',
                value: organization.name,
            }),
            Replacement.create({
                token: 'webshopName',
                value: webshop.meta.name,
            }),
        ];
    }
}

export class PrivateOrder extends Order {
    /**
     * @deprecated
     */
    @field({ decoder: PrivatePayment, nullable: true })
    payment: PrivatePayment | null = null;

    @field({ decoder: new ArrayDecoder(BalanceItemWithPrivatePayments), nullable: true, version: 225 })
    balanceItems: BalanceItemWithPrivatePayments[] = [];

    get payments() {
        return this.balanceItems.flatMap(i => i.payments.map(p => p.payment)).filter(p => p.status !== PaymentStatus.Failed).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }
}

export class PrivateOrderWithTickets extends PrivateOrder {
    @field({ decoder: new ArrayDecoder(TicketPrivate) })
    tickets: TicketPrivate[] = [];

    /**
     * Adds or removes tickets as appropriate
     */
    addTickets(tickets: TicketPrivate[]) {
        for (const ticket of tickets) {
            if (ticket.orderId === this.id) {
                if (ticket.deletedAt) {
                    const existingIndex = this.tickets.findIndex(t => t.id === ticket.id);
                    if (existingIndex !== -1) {
                        this.tickets.splice(existingIndex, 1);
                    }
                }
                else {
                    const existing = this.tickets.find(t => t.id === ticket.id);
                    if (existing) {
                        existing.set(ticket);
                    }
                    else {
                        this.tickets.push(ticket);
                    }
                }
            }
        }
    }

    addTicketPatches(patches: AutoEncoderPatchType<TicketPrivate>[]) {
        PrivateOrderWithTickets.addTicketPatches([this], patches);
    }

    static addTicketPatches(orders: PrivateOrderWithTickets[], patches: AutoEncoderPatchType<TicketPrivate>[]) {
        mainLoop: for (const patch of patches) {
            for (const order of orders) {
                for (const ticket of order.tickets) {
                    if (ticket.id === patch.id) {
                        ticket.set(ticket.patch(patch));
                        continue mainLoop;
                    }
                }
            }
        }
    }
}

export class OrderResponse extends AutoEncoder {
    @field({ decoder: StringDecoder, nullable: true })
    paymentUrl: string | null = null;

    /**
     * Data to put in a QR-code
     */
    @field({ decoder: StringDecoder, nullable: true, optional: true })
    paymentQRCode: string | null = null;

    @field({ decoder: Order })
    order: Order;
}
