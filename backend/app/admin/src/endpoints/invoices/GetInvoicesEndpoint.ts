import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints'
import { Organization, Payment, STInvoice } from '@stamhoofd/models';
import { OrganizationSimple, Payment as PaymentStruct, STInvoicePrivate } from '@stamhoofd/structures';

import { AdminToken } from '../../models/AdminToken';

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined;
type ResponseBody = STInvoicePrivate[];

export class GetInvoicesEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/invoices", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await AdminToken.authenticate(request);
        const invoices = await STInvoice.where({
            number: { sign: "!=", value: null }
        })

        // Get payments + organizations
        const paymentIds = invoices.flatMap(i => i.paymentId ? [i.paymentId] : [])
        const organizationIds = invoices.flatMap(i => i.organizationId ? [i.organizationId] : [])

        const payments = await Payment.getByIDs(...paymentIds)
        const organizations = await Organization.getByIDs(...organizationIds)

        const structures: STInvoicePrivate[] = []
        for (const invoice of invoices) {
            const payment = payments.find(p => p.id === invoice.paymentId)
            const organization = organizations.find(p => p.id === invoice.organizationId)
            structures.push(STInvoicePrivate.create(Object.assign({}, invoice, {
                payment: payment ? PaymentStruct.create(payment) : null,
                organization: organization ? OrganizationSimple.create(organization) : undefined,
                settlement: payment?.settlement ?? null,
            })))
        }
        return new Response(structures);      
    
    }
}
