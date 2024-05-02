import { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder, PatchableArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints'
import { SimpleError } from '@simonbackx/simple-errors';
import { Organization, Payment, STInvoice } from '@stamhoofd/models';
import { OrganizationSimple, Payment as PaymentStruct, PaymentMethod, PaymentStatus, STInvoicePrivate, TransferSettings } from '@stamhoofd/structures';

import { AdminToken } from '../../models/AdminToken';

type Params = Record<string, never>;
type Query = undefined;
type Body = PatchableArrayAutoEncoder<STInvoicePrivate>;
type ResponseBody = STInvoicePrivate[];

export class PatchInvoicesEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = new PatchableArrayDecoder(STInvoicePrivate as Decoder<STInvoicePrivate>, STInvoicePrivate.patchType() as Decoder<AutoEncoderPatchType<STInvoicePrivate>>, StringDecoder)

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "PATCH") {
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

        // Prepare patch
        for (const put of request.body.getPuts()) {
            const struct = put.put

            const invoice = new STInvoice()
            invoice.organizationId = null
            invoice.meta = struct.meta

            // Create a transfer payment
            if (invoice.meta.priceWithoutVAT > 0) {
                const payment = new Payment()
                payment.status = PaymentStatus.Created
                payment.method = PaymentMethod.Transfer
                payment.price = invoice.meta.priceWithVAT
                payment.transferDescription = TransferSettings.generateOGM()
                await payment.save()

                payments.push(payment)

                invoice.paymentId = payment.id
            }

            await invoice.save()

            if (invoice.meta.priceWithoutVAT > 0) {
                // Only assign a number if it was an non empty invoice
                await invoice.assignNextNumber()
            }

            if (invoice.number !== null) {
                await invoice.generatePdf()
            }

            invoices.push(invoice)
        }

        for (const patch of request.body.getPatches()) {
            const invoice = invoices.find(i => i.id === patch.id)
            if (!invoice) {
                throw new SimpleError({
                    code: "not_found",
                    message: "invoice not found"
                })
            }
            if (patch.meta) {
                invoice.meta.patchOrPut(patch.meta)
            }
        
            const payment = payments.find(p => p.id === invoice.paymentId)
            if (!payment) {
                throw new SimpleError({
                    code: "not_found",
                    message: "Payment not found"
                })
            }
            let markPaid = false;
            if (patch.payment) {
                payment.status = patch.payment.status ?? payment.status
                if (patch.payment.paidAt !== undefined || payment.status == PaymentStatus.Succeeded) {
                    payment.paidAt = patch.payment.paidAt ?? new Date()
                    markPaid = true
                }
            }
            payment.price = invoice.meta.priceWithVAT
            await payment.save()

            await invoice.save()
            if (invoice.number !== null && patch.meta) {
                await invoice.generatePdf()
            }

            if (markPaid) {
                await invoice.markPaid({sendEmail: false})
            }
        }

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
