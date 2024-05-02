import { AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Organization, STInvoice, STPendingInvoice } from '@stamhoofd/models';
import { STPendingInvoice as STPendingInvoiceStruct } from '@stamhoofd/structures';

import { AdminToken } from '../../models/AdminToken';

type Params = { id: string};
type Query = undefined;
type Body = AutoEncoderPatchType<STPendingInvoiceStruct>;
type ResponseBody = STPendingInvoiceStruct | undefined;

export class PatchPendingInvoiceEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = STPendingInvoiceStruct.patchType() as Decoder<AutoEncoderPatchType<STPendingInvoiceStruct>>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "PATCH") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/pending-invoices/@id", { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await AdminToken.authenticate(request);

        const pendingInvoice = await STPendingInvoice.getByID(request.params.id)
        if (!pendingInvoice || !pendingInvoice.organizationId) {
            throw new SimpleError({
                code: "not_found",
                message: "PendingInvoice not found",
                statusCode: 404
            })
        }
        const organization = await Organization.getByID(pendingInvoice.organizationId)

        if (!organization) {
            throw new SimpleError({
                code: "not_found",
                message: "Organization not found",
                statusCode: 404
            })
        }

        // Check delete items
        if (request.body.meta) {
            pendingInvoice.meta.patchOrPut(request.body.meta)
        }
        await pendingInvoice.save()


        const billingStatus = await STInvoice.getBillingStatus(organization, false)
        
        return new Response(billingStatus.pendingInvoice ?? undefined);      
    
    }
}
