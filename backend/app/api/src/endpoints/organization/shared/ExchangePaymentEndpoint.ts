import type { Decoder} from '@simonbackx/simple-encoding';
import { AutoEncoder, BooleanDecoder, field } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request} from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Order } from '@stamhoofd/models';
import type { PaymentGeneral } from '@stamhoofd/structures';

import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures.js';
import { Context } from '../../../helpers/Context.js';
import { PaymentService } from '../../../services/PaymentService.js';

type Params = { id: string };
class Query extends AutoEncoder {
    @field({ decoder: BooleanDecoder, optional: true })
    exchange = false;

    /**
     * If possible, cancel the payment if it is not yet paid/pending
     */
    @field({ decoder: BooleanDecoder, optional: true })
    cancel = false;
}
type Body = undefined;
type ResponseBody = PaymentGeneral | undefined;

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class ExchangePaymentEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = Query as Decoder<Query>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/payments/@id', { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOptionalOrganizationScope({ willAuthenticate: true }); // will authentiate set to true because we allow exchanges for inactive organizations
        await Context.optionalAuthenticate();

        // Not method on payment because circular references (not supprted in ts)
        const payment = await PaymentService.pollStatus(request.params.id, organization, request.query.cancel);
        if (!payment) {
            throw new SimpleError({
                code: '',
                message: $t('%EF'),
            });
        }

        if (request.query.exchange) {
            return new Response(undefined);
        }

        // Skip check permissions if order and created less than hour ago
        let checkPermissions = true;
        const hourAgo = new Date();
        hourAgo.setHours(-2);

        if (payment.createdAt > hourAgo) {
            if (payment.payingOrganizationId) {
                // B2B payments always required
                checkPermissions = true;
            } else {
                const orders = await Order.where({ paymentId: payment.id }, { limit: 1 });
                const isOrder = orders[0] !== undefined;
                if (isOrder) {
                    checkPermissions = false;
                }
            }
        }

        return new Response(
            await AuthenticatedStructures.paymentGeneral(payment, checkPermissions),
        );
    }
}
