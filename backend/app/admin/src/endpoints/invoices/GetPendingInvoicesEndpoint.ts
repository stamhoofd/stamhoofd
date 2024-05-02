import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints'
import { Organization, Payment, STInvoice, STPendingInvoice } from '@stamhoofd/models';
import { OrganizationSimple, Payment as PaymentStruct, STInvoice as STInvoiceStruct,STPendingInvoicePrivate } from '@stamhoofd/structures';

import { AdminToken } from '../../models/AdminToken';

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined;
type ResponseBody = STPendingInvoicePrivate[];

export class GetInvoicesEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/pending-invoices", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await AdminToken.authenticate(request);
        
        const pendingInvoices = await STPendingInvoice.all()
        const invoices = await STInvoice.getByIDs(...pendingInvoices.flatMap(p => p.invoiceId ? [p.invoiceId] : []))

        // Get payments + organizations
        const paymentIds = invoices.flatMap(i => i.paymentId ? [i.paymentId] : [])
        const organizationIds = pendingInvoices.flatMap(i => i.organizationId ? [i.organizationId] : [])

        const payments = await Payment.getByIDs(...paymentIds)
        const organizations = await Organization.getByIDs(...organizationIds)

        const structures: STPendingInvoicePrivate[] = []
        for (const pendingInvoice of pendingInvoices) {
            if (pendingInvoice.meta.priceWithoutVAT == 0) {
                continue
            }
            const organization = organizations.find(p => p.id === pendingInvoice.organizationId)

            const st = STPendingInvoicePrivate.create(Object.assign({}, pendingInvoice, {
                organization: organization ? OrganizationSimple.create(organization) : undefined
            }))

            if (pendingInvoice.invoiceId) {
                const invoice = invoices.find(i => i.id === pendingInvoice.invoiceId)
                if (invoice) {
                    const payment = payments.find(p => p.id === invoice.paymentId)

                    const invoiceStruct = STInvoiceStruct.create(Object.assign({}, invoice, {
                        payment: payment ? PaymentStruct.create(payment) : null,
                    }))
                    st.invoice = invoiceStruct
                }
            }
           
            structures.push(st)
        }
        return new Response(structures);      
    
    }
}
