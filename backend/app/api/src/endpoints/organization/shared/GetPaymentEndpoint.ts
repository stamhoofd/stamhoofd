import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Payment } from '@stamhoofd/models';
import { PaymentGeneral } from '@stamhoofd/structures';

import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures.js';
import { Context } from '../../../helpers/Context.js';

type Params = { id: string };
type Query = undefined;
type Body = undefined;
type ResponseBody = PaymentGeneral;

export class GetPaymentEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/payments/@id', { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.setOptionalOrganizationScope();
        await Context.authenticate();

        const payment = await Payment.getByID(request.params.id);
        if (!payment) {
            throw new SimpleError({
                code: 'not_found',
                message: 'Payment not found',
                human: $t(`6024d1b5-f0a0-42f4-b972-636286edf929`),
            });
        }

        return new Response(
            await AuthenticatedStructures.paymentGeneral(payment, true),
        );
    }
}
