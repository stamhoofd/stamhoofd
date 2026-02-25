import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { ChargeOrganizationsRequest, LimitedFilteredRequest } from '@stamhoofd/structures';

import { QueueHandler } from '@stamhoofd/queues';
import { Context } from '../../../helpers/Context.js';
import { fetchToAsyncIterator } from '../../../helpers/fetchToAsyncIterator.js';
import { OrganizationCharger } from '../../../helpers/OrganizationCharger.js';
import { GetOrganizationsEndpoint } from './GetOrganizationsEndpoint.js';

type Params = Record<string, never>;
type Query = LimitedFilteredRequest;
type Body = ChargeOrganizationsRequest;
type ResponseBody = undefined;

export class ChargeOrganizationsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = LimitedFilteredRequest as Decoder<LimitedFilteredRequest>;
    bodyDecoder = ChargeOrganizationsRequest as Decoder<ChargeOrganizationsRequest>;

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

    private static throwIfInvalidBody(body: Body) {
        if (!body.description?.trim()?.length) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Invalid description',
                human: $t(`2449fba5-99dc-496f-a9d6-a67263d56616`),
                field: 'description',
            });
        }

        if (!body.price) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Invalid price',
                human: $t(`1e165aac-8a58-45c5-bdd8-c58131a7b7f5`),
                field: 'price',
            });
        }

        if (body.amount === 0) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Invalid amount',
                human: $t(`0bdf4953-1eae-41fd-b142-5ad3287f17a7`),
                field: 'amount',
            });
        }

        if (!body.organizationId) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Invalid organization id',
                human: $t(`ae7ac6ab-bb02-4cd6-823f-7076e4ce6f6c`),
                field: 'organizationId',
            });
        }
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.authenticate();

        if (!Context.auth.hasPlatformFullAccess()) {
            throw Context.auth.error();
        }

        const body = request.body;
        ChargeOrganizationsEndpoint.throwIfInvalidBody(body);

        const queueId = 'charge-organizations';

        if (QueueHandler.isRunning(queueId)) {
            throw new SimpleError({
                code: 'charge_pending',
                message: 'Charge organizations already pending',
                human: $t(`d2b84fdd-035b-4307-a897-000081aa814f`),
            });
        }

        await QueueHandler.schedule(queueId, async () => {
            const dataGenerator = fetchToAsyncIterator(request.query, {
                fetch: GetOrganizationsEndpoint.buildData,
            });

            for await (const data of dataGenerator) {
                await OrganizationCharger.chargeMany({
                    chargingOrganizationId: body.organizationId,
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
