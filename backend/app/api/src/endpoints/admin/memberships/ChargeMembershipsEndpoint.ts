import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { QueueHandler } from '@stamhoofd/queues';
import { Context } from '../../../helpers/Context.js';
import { MembershipCharger } from '../../../helpers/MembershipCharger.js';

type Params = Record<string, never>;
type Query = Record<string, never>;
type Body = undefined;
type ResponseBody = undefined;

export class ChargeMembershipsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/admin/charge-memberships', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.authenticate();

        if (!Context.auth.hasPlatformFullAccess()) {
            throw Context.auth.error();
        }

        if (QueueHandler.isRunning('charge-memberships')) {
            throw new SimpleError({
                code: 'charge_pending',
                message: 'Charge already pending',
                human: $t(`d2b84fdd-035b-4307-a897-000081aa814f`),
            });
        }

        QueueHandler.schedule('charge-memberships', async () => {
            await MembershipCharger.charge();
        }).catch(console.error);

        return new Response(undefined);
    }
}
