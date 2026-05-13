import type { Decoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Organization } from '@stamhoofd/models';
import { PackageCheckout } from '@stamhoofd/structures';
import { Context } from '../../../../helpers/Context.js';
import { PaymentMandateService } from '../../../../services/PaymentMandateService.js';

type Params = { id: string, sellingOrganizationId: string };
type Query = undefined;
type Body = undefined;
type ResponseBody = undefined

export class DeleteOrganizationMandateEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = PackageCheckout as Decoder<Query>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'DELETE') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/billing/@sellingOrganizationId/mandates/@id', {sellingOrganizationId: String, id: String});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const payingOrganization = await Context.setOrganizationScope();
        const { user } = await Context.authenticate();

       const id = request.params.sellingOrganizationId;
        if (!id) {
            throw new SimpleError({
                code: 'unavailable',
                message: 'This is temporarily unavailable',
                human: $t('Dit is tijdelijk onbeschikbaar, probeer later opnieuw')
            })
        }
        
        const sellingOrganization = await Organization.getByID(id);
        if (!sellingOrganization || !sellingOrganization.active) {
            throw new SimpleError({
                statusCode: 404,
                code: 'not_found',
                message: 'Selling organization not found',
                human: $t('Deze organisatie bestaat niet (meer)'),
                field: 'sellingOrganization'
            })
        }

        await PaymentMandateService.deleteMandate({
            mandateId: request.params.id,
            sellingOrganization,
            user,
            payingOrganization
        })

        const r = new Response(undefined);
        r.status = 201;
        return r;
    }
}
