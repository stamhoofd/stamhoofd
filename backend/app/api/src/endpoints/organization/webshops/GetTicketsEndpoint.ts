import type { Decoder } from '@simonbackx/simple-encoding';
import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Order, Ticket, Webshop } from '@stamhoofd/models';
import { TicketOrder, TicketPublic } from '@stamhoofd/structures';

import { Context } from '../../../helpers/Context.js';
import { WebshopAuthHelper } from './WebshopAuthHelper.js';
type Params = { id: string };

class Query extends AutoEncoder {
    /**
     * Get one ticket by the secret of an individual ticket
     */
    @field({ decoder: StringDecoder, optional: true })
    secret?: string;

    /**
     * Get all tickets of a single order if key is not passed.
     * If key is passed, only return a single ticket, but exclude item information
     */
    @field({ decoder: StringDecoder, optional: true })
    orderId?: string;
}

type Body = undefined;
type ResponseBody = TicketPublic[] | TicketOrder[];

export class GetTicketsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = Query as Decoder<Query>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/webshop/@id/tickets', { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope({ willAuthenticate: false });
        const webshop = await Webshop.select()
            .where('id', request.params.id)
            .where('organizationId', organization.id)
            .first(false);
        if (!webshop || webshop.organizationId !== organization.id) {
            throw new SimpleError({
                code: 'not_found',
                message: 'Webshop not found',
                human: $t(`%FX`),
            });
        }

        if (request.query.secret) {
            const [ticket] = await Ticket.where({
                secret: request.query.secret,
                webshopId: request.params.id,
                organizationId: organization.id,
            }, { limit: 1 });

            if (!ticket || (request.query.orderId && ticket.orderId !== request.query.orderId) || ticket.isDeleted) {
                throw new SimpleError({
                    code: 'not_found',
                    message: 'Ticket not found',
                    human: $t(`%FZ`),
                });
            }

            const order = await Order.select()
                .where('id', ticket.orderId)
                .where('organizationId', organization.id)
                .where('webshopId', request.params.id)
                .first(false);
            if (!order || order.webshopId !== request.params.id || order.organizationId !== organization.id) {
                console.error('Error: missing order ' + ticket.orderId + ' for ticket ' + ticket.id);
                throw new SimpleError({
                    code: 'not_found',
                    message: 'Ticket not found',
                    human: $t(`%FZ`),
                });
            }

            await WebshopAuthHelper.checkOrderAccess(webshop, order);

            if (!request.query.orderId) {
                // Include item data

                if (ticket.itemId) {
                    const item = order.data.cart.items.find(i => i.id === ticket.itemId);

                    if (!item) {
                        console.error('Error: missing item ' + ticket.itemId + ' for ticket ' + ticket.id);
                        throw new SimpleError({
                            code: 'not_found',
                            message: 'Ticket not found',
                            human: $t(`%FZ`),
                        });
                    }

                    return new Response([
                        TicketPublic.create({
                            ...ticket,
                            items: [item],
                        }),
                    ]);
                } else {
                    return new Response([
                        TicketPublic.create({
                            ...ticket,
                            items: order.data.cart.items,
                        }),
                    ]);
                }
            }
            return new Response([
                TicketOrder.create(ticket),
            ]);
        } else {
            if (!request.query.orderId) {
                throw new SimpleError({
                    code: 'not_found',
                    message: 'At least one query parameter expected: secret, orderId',
                });
            }

            const tickets = await Ticket.where({
                orderId: request.query.orderId,
                webshopId: request.params.id,
                organizationId: organization.id,
                deletedAt: null,
            });

            const order = await Order.select()
                .where('id', request.query.orderId)
                .where('organizationId', organization.id)
                .where('webshopId', request.params.id)
                .first(false);
            if (!order || order.webshopId !== request.params.id || order.organizationId !== organization.id) {
                throw new SimpleError({
                    code: 'not_found',
                    message: 'Ticket not found',
                    human: $t(`%FZ`),
                });
            }

            await WebshopAuthHelper.checkOrderAccess(webshop, order);
            return new Response(
                tickets.map(ticket => TicketOrder.create(ticket)),
            );
        }
    }
}
