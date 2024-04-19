import { Decoder } from "@simonbackx/simple-encoding";
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { Ticket, Webshop } from '@stamhoofd/models';
import { PaginatedResponse, PermissionLevel, TicketPrivate, WebshopTicketsQuery } from "@stamhoofd/structures";

import { Context } from "../../../../helpers/Context";

type Params = { id: string };
type Query = WebshopTicketsQuery
type Body = undefined
type ResponseBody = PaginatedResponse<TicketPrivate, Query>

export class GetWebshopTicketsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = WebshopTicketsQuery as Decoder<WebshopTicketsQuery>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/webshop/@id/tickets/private", { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.setOrganizationScope();
        await Context.authenticate()

        // Fast throw first (more in depth checking for patches later)
        if (!Context.auth.hasSomeAccess()) {
            throw Context.auth.error()
        }

        const webshop = await Webshop.getByID(request.params.id)
        if (!webshop || !Context.auth.canAccessWebshopTickets(webshop, PermissionLevel.Read)) {
            throw Context.auth.notFoundOrNoAccess("Je hebt geen toegang tot de tickets van deze webshop")
        }
        
        let tickets: Ticket[] | undefined = undefined
        const limit = 150

        if (request.query.updatedSince !== undefined) {
            if (request.query.lastId !== undefined) {
                tickets = await Ticket.select("WHERE webshopId = ? AND (updatedAt > ? OR (updatedAt = ? AND id > ?)) ORDER BY updatedAt, id LIMIT ?", [webshop.id, request.query.updatedSince, request.query.updatedSince, request.query.lastId, limit])
            } else {
                tickets = await Ticket.select("WHERE webshopId = ? AND updatedAt >= ? ORDER BY updatedAt, id LIMIT ?", [webshop.id, request.query.updatedSince, limit])
            }
        } else {
            tickets = await Ticket.select("WHERE webshopId = ? ORDER BY updatedAt, id LIMIT ?", [webshop.id, limit])
        }

        const supportsDeletedTickets = request.request.getVersion() >= 229

        return new Response(
            new PaginatedResponse({ 
                results: tickets.map(ticket => TicketPrivate.create(ticket)).filter(ticket => supportsDeletedTickets || !ticket.deletedAt),
                next: tickets.length >= limit ? WebshopTicketsQuery.create({
                    updatedSince: tickets[tickets.length - 1].updatedAt ?? undefined,
                    lastId: tickets[tickets.length - 1].id ?? undefined
                }) : undefined
            })
        );
    }
}
