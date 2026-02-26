import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { ChargeRequest, LimitedFilteredRequest } from '@stamhoofd/structures';

import { QueueHandler } from '@stamhoofd/queues';
import { Context } from '../../../helpers/Context.js';
import { fetchToAsyncIterator } from '../../../helpers/fetchToAsyncIterator.js';
import { OrganizationCharger } from '../../../helpers/OrganizationCharger.js';
import { GetOrganizationsEndpoint } from './GetOrganizationsEndpoint.js';
import { ChargeMembersEndpoint } from '../members/ChargeMembersEndpoint.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = ChargeRequest;
type ResponseBody = undefined;

export class ChargeOrganizationsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = ChargeRequest as Decoder<ChargeRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/admin/charge-organizations', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate();

        if (!Context.auth.hasPlatformFullAccess()) {
            throw Context.auth.error();
        }

        const body = request.body;
        ChargeMembersEndpoint.throwIfInvalidBody(body);

        const queueId = 'charge-organizations';

        if (QueueHandler.isRunning(queueId)) {
            throw new SimpleError({
                code: 'charge_pending',
                message: 'Charge organizations already pending',
                human: $t(`d2b84fdd-035b-4307-a897-000081aa814f`),
            });
        }

        await QueueHandler.schedule(queueId, async () => {
            const dataGenerator = fetchToAsyncIterator(new LimitedFilteredRequest({
                filter: body.filter,
                limit: 100,
            }), {
                fetch: GetOrganizationsEndpoint.buildData,
            });

            for await (const data of dataGenerator) {
                await OrganizationCharger.chargeMany({
                    chargingOrganizationId: organization.id,
                    organizationsToCharge: data,
                    price: body.price,
                    amount: body.amount ?? 1,
                    description: body.description,
                    dueAt: body.dueAt,
                    createdAt: body.createdAt,
                });
            }
        });

        return new Response(undefined);
    }
}
