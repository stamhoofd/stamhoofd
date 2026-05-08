import type { Decoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { PackageCheckout } from '@stamhoofd/structures';
import type { PaymentMandate } from '@stamhoofd/structures/PaymentMandate.js';
import { Context } from '../../../helpers/Context.js';
import { PaymentMandateService } from '../../../services/PaymentMandateService.js';
import { Organization, Platform } from '@stamhoofd/models';
import type { OrganizationMandatesRequest } from '@stamhoofd/structures/checkout/OrganizationMandatesRequest.js'
import { SimpleError } from '@simonbackx/simple-errors';

type Params = Record<string, never>;
type Query = OrganizationMandatesRequest;
type Body = undefined;
type ResponseBody = PaymentMandate[];

export class GetOrganizationMandatesEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = PackageCheckout as Decoder<Query>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/billing/mandates', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const payingOrganization = await Context.setOrganizationScope();
        const { user } = await Context.authenticate();

        const id = request.query.sellingOrganizationId ?? ((await Platform.getShared()).membershipOrganizationId);
        if (!id) {
            throw new SimpleError({
                code: 'unavailable',
                message: 'This is temporarily unavailable',
                human: $t('Dit is tijdelijk onbeschikbaar, probeer later opnieuw')
            })
        }
        
        const sellingOrganization = await Organization.getByID(id);
        if (!sellingOrganization) {
            throw new SimpleError({
                statusCode: 404,
                code: 'not_found',
                message: 'Selling organization not found',
                human: $t('Deze organisatie bestaat niet (meer)'),
                field: 'sellingOrganization'
            })
        }

        const mandates = await PaymentMandateService.getMandates({
            sellingOrganization,
            user,
            payingOrganization
        })

       return new Response(mandates);
    }
}
