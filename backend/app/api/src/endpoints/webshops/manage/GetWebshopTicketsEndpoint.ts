import { Decoder } from "@simonbackx/simple-encoding";
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Ticket } from '@stamhoofd/models';
import { Token } from '@stamhoofd/models';
import { Webshop } from '@stamhoofd/models';
import { PaginatedResponse, PermissionLevel,TicketPrivate, WebshopTicketsQuery } from "@stamhoofd/structures";

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
        const token = await Token.authenticate(request);
        const errors = new SimpleErrors()

        const webshop = await Webshop.getByID(request.params.id)
        if (!webshop || token.user.organizationId != webshop.organizationId) {
            throw new SimpleError({
                code: "not_found",
                message: "Webshop not found",
                human: "Deze webshop bestaat niet (meer)"
            })
        }

        if (!webshop.privateMeta.permissions.userHasAccess(token.user, PermissionLevel.Read)) {
            if (!webshop.privateMeta.scanPermissions.userHasAccess(token.user, PermissionLevel.Read)) {
                throw new SimpleError({
                    code: "permission_denied",
                    message: "No permissions for this webshop",
                    human: "Je hebt geen toegang tot de tickets van deze webshop",
                    statusCode: 403
                })
            }
        }
        
        errors.throwIfNotEmpty()

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
