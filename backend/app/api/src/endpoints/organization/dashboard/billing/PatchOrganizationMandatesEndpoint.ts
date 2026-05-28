import type { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Organization } from '@stamhoofd/models';
import { PaymentMandate } from '@stamhoofd/structures/PaymentMandate.js';
import { Context } from '../../../../helpers/Context.js';
import { PaymentMandateService } from '../../../../services/PaymentMandateService.js';

type Params = { sellingOrganizationId: string };
type Query = undefined;
type Body = PatchableArrayAutoEncoder<PaymentMandate>;
type ResponseBody = PaymentMandate[];

export class DeleteOrganizationMandateEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = new PatchableArrayDecoder(
        PaymentMandate as Decoder<PaymentMandate>,
        PaymentMandate.patchType() as Decoder<AutoEncoderPatchType<PaymentMandate>>,
        StringDecoder,
    ) as Decoder<PatchableArrayAutoEncoder<PaymentMandate>>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'PATCH') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/billing/@sellingOrganizationId/mandates', { sellingOrganizationId: String });

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
                human: $t('%1Rz'),
            });
        }

        const sellingOrganization = await Organization.getByID(id);
        if (!sellingOrganization || !sellingOrganization.active) {
            throw new SimpleError({
                statusCode: 404,
                code: 'not_found',
                message: 'Selling organization not found',
                human: $t('%1R5'),
                field: 'sellingOrganization',
            });
        }

        const mandates = await PaymentMandateService.getMandates({
            sellingOrganization,
            user,
            payingOrganization,
        });

        for (const patch of request.body.getPatches()) {
            const mandate = mandates.find(m => m.id === patch.id);
            if (!mandate) {
                throw new SimpleError({
                    code: 'not_found',
                    message: 'This payment mandate is not found',
                    human: $t('%1R8'),
                });
            }

            if (patch.isDefault === true) {
                await PaymentMandateService.setDefaultMandate({
                    mandateId: mandate.id,
                    sellingOrganizationId: sellingOrganization.id,
                    payingOrganizationId: payingOrganization,
                    payingUserId: null,
                });
            }
        }

        const updatedMandates = await PaymentMandateService.getMandates({
            sellingOrganization,
            user,
            payingOrganization,
        });

        return new Response(PaymentMandateService.groupByMandate(updatedMandates).mandates);
    }
}
