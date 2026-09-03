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

export class PatchOrganizationMandatesEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
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

            if (patch.blockedAt !== undefined) {
                // Only the seller can block or unblock
                if (!await Context.auth.canManagePayments(sellingOrganization.id)) {
                    throw Context.auth.error();
                }

                if (patch.blockedAt) {
                    await PaymentMandateService.blockMandate({
                        mandateId: mandate.id,
                        sellingOrganization,
                        payingOrganizationId: payingOrganization.id,
                        paymentId: null,
                    });
                    mandate.blockedAt = patch.blockedAt;
                } else {
                    await PaymentMandateService.unblockMandate({
                        mandateId: mandate.id,
                        sellingOrganization,
                        payingOrganizationId: payingOrganization.id,
                    });
                    mandate.blockedAt = null;
                }
            }

            if (patch.isDefault === true) {
                if (mandate.isBlocked) {
                    throw new SimpleError({
                        code: 'mandate_blocked',
                        message: 'Cannot set a blocked mandate as default',
                        human: $t('%Zqf'),
                    });
                }

                await PaymentMandateService.setDefaultMandate({
                    mandateId: mandate.id,
                    sellingOrganizationId: sellingOrganization.id,
                    payingOrganizationId: payingOrganization,
                    payingUserId: null,
                });
            }
        }

        // serverMeta was modified on a separate instance: reload before reading blocks and the default
        const updatedMandates = await PaymentMandateService.getMandates({
            sellingOrganization,
            user,
            payingOrganization: await Organization.getByID(payingOrganization.id, true),
        });

        return new Response(PaymentMandateService.groupByMandate(updatedMandates).mandates);
    }
}
