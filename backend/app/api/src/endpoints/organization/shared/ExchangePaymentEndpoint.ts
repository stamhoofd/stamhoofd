import { AutoEncoder, BooleanDecoder, Decoder, field } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Order } from '@stamhoofd/models';
import { PaymentGeneral } from '@stamhoofd/structures';

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
        const organization = await Context.setOptionalOrganizationScope({ willAuthenticate: false });
        if (!request.query.exchange) {
            await Context.optionalAuthenticate();
        }

        // Not method on payment because circular references (not supprted in ts)
        const payment = await PaymentService.pollStatus(request.params.id, organization, request.query.cancel);
        if (!payment) {
            throw new SimpleError({
                code: '',
                message: $t('35b369bd-5766-41d1-8da3-3d362e316c1a'),
            });
        }

        if (request.query.exchange) {
            return new Response(undefined);
        }

        // #region skip check permissions if order and created less than hour ago
        let checkPermissions = true;
        const hourAgo = new Date();
        hourAgo.setHours(-1);

        if (payment.createdAt > hourAgo) {
            const orders = await Order.where({ paymentId: payment.id }, { limit: 1 });
            const isOrder = orders[0] !== undefined;
            if (isOrder) {
                checkPermissions = false;
            }
        }
        // #endregion

        return new Response(
            await AuthenticatedStructures.paymentGeneral(payment, checkPermissions),
        );
    }
}
