import { I18n } from '@stamhoofd/backend-i18n';
import type { Organization, Payment, Ticket } from '@stamhoofd/models';
import { Order, sendEmailTemplate, Webshop, WebshopCounter } from '@stamhoofd/models';
import { EmailTemplateType, OrderStatus, PaymentMethod, Recipient, Replacement, WebshopPreview, WebshopStatus, WebshopTicketType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

/**
 * An order with its webshop, and the organization of that webshop, loaded.
 *
 * The order emails need both, so they are required by the signature instead of being fetched (or
 * assumed) here: the caller already has them in almost every case.
 */
export type OrderWithWebshop = Order & { webshop: Webshop & { organization: Organization } };

/**
 * Owns the lifecycle transitions of an order (valid / paid) and the customer emails they send.
 *
 * Sibling models already have their transitions in a service (BalanceItemService, RegistrationService,
 * STPackageService); orders were the exception. Composing an email also needs the email templates and
 * the platform behind them, which the lowest model layer must not resolve, so it lives here.
 */
export class OrderService {
    /**
     * Only call this once! Make sure you use the queues correctly
     */
    static async markPaid(order: Order, payment: Payment | null, organization: Organization, knownWebshop?: Webshop) {
        if (!order.id) {
            await order.save();
        }
        console.log('Marking order ' + order.id + ' as paid');

        const webshop = (knownWebshop ?? (await Webshop.getByID(order.webshopId)))?.setRelation(Webshop.organization, organization);
        if (!webshop) {
            console.error('Missing webshop for order ' + order.id);
            return;
        }

        if (order.status === OrderStatus.Deleted) {
            await order.undoPaymentFailed(payment, organization);
        }

        const loadedOrder = order.setRelation(Order.webshop, webshop);
        const { tickets, didCreateTickets } = await loadedOrder.updateTickets({ hasPaidPayment: true });

        // Needs to happen before validation, because we can include the tickets in the validation that way
        if (order.validAt === null) {
            await this.markValid(loadedOrder, payment, tickets);
        } else {
            order.markUpdated();
            await order.save();

            if (!order.data.shouldSendPaymentUpdates) {
                console.log('Skip sending paid email for order ' + order.id);
                return;
            }
            if (order.data.customer.email.length > 0) {
                if (didCreateTickets) {
                    await this.sendTickets(loadedOrder);
                } else {
                    if (payment && payment.method === PaymentMethod.Transfer) {
                        await this.sendPaidMail(loadedOrder);
                    }
                }
            }
        }
    }

    /**
     * WARNING: this should always run inside a queue so it only runs once for the same order
     * Include any tickets that are generated and should be included in the e-mail
     */
    static async markValid(order: OrderWithWebshop, payment: Payment | null, tickets: Ticket[]) {
        const webshop = order.webshop;
        const organization = webshop.organization;

        console.log('Marking as valid: order ' + order.id);
        const wasValid = order.validAt !== null;

        if (wasValid) {
            console.warn('Warning: already validated an order');
            return;
        }
        order.validAt = new Date(); // will get flattened AFTER calculations
        order.validAt.setMilliseconds(0);
        order.number = await WebshopCounter.getNextNumber(webshop);

        if (payment && !Order.payment.isLoaded(order)) {
            order.setRelation(Order.payment, payment);
        }

        // Now we have a number, update the payment
        if (payment && payment.method === PaymentMethod.Transfer) {
            // Only now we can update the transfer description, since we need the order number as a reference
            payment.transferSettings = order.getTransferSettings({ shouldThrowIfNoIban: true });
            payment.generateDescription(organization, order.number.toString(), order.getTransferReplacements());
            await payment.save();
        }

        await order.save();

        if (order.data.customer.email.length > 0) {
            if (tickets.length > 0) {
                // Also send a copy
                if (payment && payment.method === PaymentMethod.PointOfSale) {
                    await this.sendEmailTemplate(order, {
                        type: EmailTemplateType.TicketsConfirmationPOS,
                    });
                } else {
                    await this.sendEmailTemplate(order, {
                        type: EmailTemplateType.TicketsConfirmation,
                    });
                }
            } else {
                if (webshop.meta.ticketType === WebshopTicketType.None) {
                    if (payment && payment.method === PaymentMethod.Transfer) {
                        // Also send a copy
                        await this.sendEmailTemplate(order, {
                            type: EmailTemplateType.OrderConfirmationTransfer,
                        });
                    } else if (payment && payment.method === PaymentMethod.PointOfSale) {
                        await this.sendEmailTemplate(order, {
                            type: EmailTemplateType.OrderConfirmationPOS,
                        });
                    } else {
                        // Also send a copy
                        await this.sendEmailTemplate(order, {
                            type: EmailTemplateType.OrderConfirmationOnline,
                        });
                    }
                } else {
                    if (payment && payment.method === PaymentMethod.Transfer) {
                        await this.sendEmailTemplate(order, {
                            type: EmailTemplateType.TicketsConfirmationTransfer,
                        });
                    } else {
                        console.error('Unexpected missing tickets for order where tickets are expected');
                    }
                }
            }
        }

        if (webshop.privateMeta.notificationEmails) {
            const i18n = organization.i18n;

            const webshopDashboardUrl = 'https://' + (STAMHOOFD.domains.dashboard ?? 'stamhoofd.app') + '/' + i18n.locale + '/webshops/' + Formatter.slug(webshop.meta.name) + '/orders';

            // Send an email to all these notification emails
            for (const email of webshop.privateMeta.notificationEmails) {
                await this.sendEmailTemplate(order, {
                    type: EmailTemplateType.OrderNotification,
                    to: Recipient.create({
                        email,
                        replacements: [
                            Replacement.create({
                                token: 'orderUrl',
                                value: webshopDashboardUrl,
                            }),
                        ],
                    }),
                });
            }
        }
    }

    static async sendPaidMail(order: OrderWithWebshop) {
        // For a tickets webshop, where the order was marked as paid / non-paid, we should still send the tickets email
        // - because the normal email is not editable
        const hasTickets = order.webshop.meta.hasTickets;

        await this.sendEmailTemplate(order, {
            type: hasTickets ? EmailTemplateType.TicketsReceivedTransfer : EmailTemplateType.OrderReceivedTransfer,
        });
    }

    static async sendTickets(order: OrderWithWebshop) {
        await this.sendEmailTemplate(order, {
            type: EmailTemplateType.TicketsReceivedTransfer,
        });
    }

    static async sendEmailTemplate(order: OrderWithWebshop, data: {
        type: EmailTemplateType;
        to?: Recipient;
    }) {
        // Never send an email for archived webshops
        if (order.webshop.meta.status === WebshopStatus.Archived) {
            return;
        }

        // Render all $t's (recipient replacements, order tables, template...) in the language
        // the customer used while placing the order, instead of the current request language.
        const i18n = new I18n(order.consumerLanguage, order.webshop.organization.address.country);

        await I18n.runWithLocale(i18n, async () => {
            let recipient = (await order.getStructure()).getRecipient(
                order.webshop.organization.getBaseStructure(),
                WebshopPreview.create(order.webshop),
            );

            if (data.to) {
                // Clear first and last name
                recipient.firstName = null;
                recipient.lastName = null;
                recipient.language = order.webshop.meta.defaultLanguage;
                recipient.replacements = recipient.replacements.filter(r => !['firstName', 'lastName'].includes(r.token));
                data.to.merge(recipient);
                recipient = data.to;
            }

            // Create e-mail builder
            await sendEmailTemplate(order.webshop.organization, {
                recipients: [recipient],
                template: {
                    type: data.type,
                    webshop: order.webshop,
                },
                type: 'transactional',
            });
        });
    }
}
