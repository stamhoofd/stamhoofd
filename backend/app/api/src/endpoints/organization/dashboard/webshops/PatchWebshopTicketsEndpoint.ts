import { ArrayDecoder, AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError, SimpleErrors } from "@simonbackx/simple-errors";
import { Ticket, Token, Webshop } from '@stamhoofd/models';
import { PermissionLevel, TicketPrivate } from "@stamhoofd/structures";

import { Context } from '../../../../helpers/Context';

type Params = { id: string };
type Query = undefined;
type Body = AutoEncoderPatchType<TicketPrivate>[]
type ResponseBody = TicketPrivate[]

export class PatchWebshopTicketsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = new ArrayDecoder(TicketPrivate.patchType() as Decoder<AutoEncoderPatchType<TicketPrivate>>)

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "PATCH") {
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

        if (request.body.length == 0) {
            return new Response([]);
        }

        const webshop = await Webshop.getByID(request.params.id)
        if (!webshop || !Context.auth.canAccessWebshopTickets(webshop, PermissionLevel.Write)) {
            throw Context.auth.notFoundOrNoAccess("Je hebt geen toegang om tickets te wijzigen van deze webshop")
        }

        const tickets: Ticket[] = []
        const errors = new SimpleErrors()

        for (const patch of request.body) {
            const model = await Ticket.getByID(patch.id)
            if (!model || model.webshopId !== webshop.id) {
                errors.addError(new SimpleError({
                    code: "ticket_not_found",
                    field: patch.id,
                    message: "Ticket with id "+patch.id+" does not exist"
                }))
                continue
            }

            if (patch.scannedAt !== undefined) {
                model.scannedAt = patch.scannedAt
            }

            if (patch.scannedBy !== undefined) {
                model.scannedBy = patch.scannedBy
            }

            await model.save()

            tickets.push(model)
        }

        errors.throwIfNotEmpty();
        return new Response(
            tickets.map(ticket => TicketPrivate.create(ticket))
        );
    }
}
