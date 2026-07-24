import type { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { Invoice as InvoiceStruct } from '@stamhoofd/structures';

import { AuthenticatedStructures } from '../../../../helpers/AuthenticatedStructures.js';
import { Context } from '../../../../helpers/Context.js';
import { Invoice } from '@stamhoofd/models';
import { SimpleError } from '@simonbackx/simple-errors';
import { ViesHelper } from '../../../../helpers/ViesHelper.js';
import { InvoiceService } from '../../../../services/InvoiceService.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = PatchableArrayAutoEncoder<InvoiceStruct>;
type ResponseBody = InvoiceStruct[];

export class PatchInvoicesEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = new PatchableArrayDecoder(InvoiceStruct as Decoder<InvoiceStruct>, InvoiceStruct.patchType() as Decoder<AutoEncoderPatchType<InvoiceStruct>>, StringDecoder);

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'PATCH') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/invoices', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate();

        // Fast throw first (more in depth checking for patches later)
        if (!await Context.auth.hasFullAccess(organization.id)) {
            throw Context.auth.error();
        }

        const invoices: Invoice[] = [];

        for (const { put } of request.body.getPuts()) {
            if (put.payingOrganizationId) {
                if (!await Context.auth.hasFullAccess(put.payingOrganizationId)) {
                    Context.auth.error($t('%1Xw'));
                }
            }

            put.stripeAccountId = null;
            put.reference = null;

            const model = await InvoiceService.createFrom(organization, put);
            invoices.push(model);
        }

        for (const patch of request.body.getPatches()) {
            const model = await Invoice.getByID(patch.id);
            if (!model || model.organizationId !== organization.id) {
                throw Context.auth.notFoundOrNoAccess($t('%ZcE'));
            }

            if (!model.number) {
                // ignore
                continue;
            }

            // Create PDF
            if (patch.pdf === null) {
                await InvoiceService.retryInvoiceGenerationAndSending(model);
            }
            invoices.push(model);
        }

        for (const id of request.body.getDeletes()) {
            const model = await Invoice.getByID(id);
            if (!model || model.organizationId !== organization.id) {
                throw Context.auth.notFoundOrNoAccess($t('%ZcE'));
            }

            await InvoiceService.delete(model);
        }

        return new Response(
            await AuthenticatedStructures.invoices(invoices, true),
        );
    }
}
