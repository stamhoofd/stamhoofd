import { Migration } from '@simonbackx/simple-database';
import { logger } from '@simonbackx/simple-logging';
import { Order, Organization, Payment, Ticket, Webshop } from '@stamhoofd/models';
import { EmailTemplateType, PaymentMethod,Recipient, Replacement, WebshopTicketType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

export default new Migration(async () => {
    if (STAMHOOFD.environment == "test") {
        console.log("skipped in tests")
        return;
    }

    process.stdout.write('\n');
    let c = 0;
    let id: string = '';

    await logger.setContext({tags: ['silent-seed', 'seed']}, async () => {
        while(true) {
            const orders = await Order.where({
                id: {
                    value: id,
                    sign: '>'
                },
                validAt: [{
                    sign: '>',
                    value: '2024-09-16 00:00:00'
                }, {
                    sign: '<',
                    value: '2024-09-16 05:48:00'
                }],
            }, {limit: 100, sort: ['id']});

            if (orders.length === 0) {
                break;
            }

            for (const order of orders) {
                c++;
                process.stdout.write('.');
                if (c%100 === 0) {
                    process.stdout.write('\n');
                }

                await send.call(order);
            }

            if (orders.length < 100) {
                break;
            }
            id = orders[orders.length - 1].id;
        }
    })

    console.log("Processed "+c+" orders")

    // Do something here
    return Promise.resolve()
});


async function send(this: Order) {
    if (!this.number) {
        return;
    }

    const organization = await Organization.getByID(this.organizationId);

    if (!organization) {
        console.error("Missing organization for order "+this.id)
        return
    }

    const webshop = (await Webshop.getByID(this.webshopId))?.setRelation(Webshop.organization, organization);
    if (!webshop) {
        console.error("Missing webshop for order "+this.id)
        return
    }

    const { tickets } = await this.setRelation(Order.webshop, webshop).updateTickets()

     if (this.data.customer.email.length > 0) {
        const { from, replyTo } = organization.getEmail(webshop.privateMeta.defaultEmailId, true)
    
        if (tickets.length > 0) {
            // Also send a copy
            if (this.data.paymentMethod === PaymentMethod.PointOfSale) {
                await this.setRelation(Order.webshop, webshop).sendEmailTemplate({
                    type: EmailTemplateType.TicketsConfirmationPOS,
                    from,
                    replyTo
                })
            } else {
                await this.setRelation(Order.webshop, webshop).sendEmailTemplate({
                    type: EmailTemplateType.TicketsConfirmation,
                    from,
                    replyTo
                })
            }
        } else {
            if (webshop.meta.ticketType === WebshopTicketType.None) {

                if (this.data.paymentMethod === PaymentMethod.Transfer) {
                    // Also send a copy
                    await this.setRelation(Order.webshop, webshop).sendEmailTemplate({
                        type: EmailTemplateType.OrderConfirmationTransfer,
                        from,
                        replyTo
                    })
                } else if (this.data.paymentMethod === PaymentMethod.PointOfSale) {
                    await this.setRelation(Order.webshop, webshop).sendEmailTemplate({
                        type: EmailTemplateType.OrderConfirmationPOS,
                        from,
                        replyTo
                    })
                } else {
                    // Also send a copy
                    await this.setRelation(Order.webshop, webshop).sendEmailTemplate({
                        type: EmailTemplateType.OrderConfirmationOnline,
                        from,
                        replyTo
                    })
                }
                
            } else {
                await this.setRelation(Order.webshop, webshop).sendEmailTemplate({
                    type: EmailTemplateType.TicketsConfirmationTransfer,
                    from,
                    replyTo
                })
            }
        }
    }

    if (webshop.privateMeta.notificationEmails) {
        const { from, replyTo } = organization.getEmail(webshop.privateMeta.defaultEmailId, true)
        const i18n = organization.i18n;

        const webshopDashboardUrl = "https://"+(STAMHOOFD.domains.dashboard ?? "stamhoofd.app")+"/"+i18n.locale + '/webshops/'+Formatter.slug(webshop.meta.name)+'/orders';

        // Send an email to all these notification emails
        for (const email of webshop.privateMeta.notificationEmails) {
            await this.setRelation(Order.webshop, webshop).sendEmailTemplate({
                type: EmailTemplateType.OrderNotification,
                from,
                replyTo,
                to: Recipient.create({
                    email,
                    replacements: [
                        Replacement.create({
                            token: 'orderUrl',
                            value: webshopDashboardUrl
                        })
                    ]
                })
            })
        }
    }
}