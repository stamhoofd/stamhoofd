import { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder, PatchableArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
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
            const model = await InvoiceService.createFrom(organization, put);
            invoices.push(model);
        }

        return new Response(
            await AuthenticatedStructures.invoices(invoices),
        );
    }
}
