import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { ChargeRequest, LimitedFilteredRequest, PermissionLevel } from '@stamhoofd/structures';

import { QueueHandler } from '@stamhoofd/queues';
import { Context } from '../../../helpers/Context.js';
import { fetchToAsyncIterator } from '../../../helpers/fetchToAsyncIterator.js';
import { MemberCharger } from '../../../helpers/MemberCharger.js';
import { GetMembersEndpoint } from '../../global/members/GetMembersEndpoint.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = ChargeRequest;
type ResponseBody = undefined;

export class ChargeMembersEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = ChargeRequest as Decoder<ChargeRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/admin/charge-members', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    static throwIfInvalidBody(body: Body) {
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
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        const body = request.body;

        await Context.authenticate();

        if (!await Context.auth.canManagePayments(organization.id)) {
            throw Context.auth.error();
        }

        ChargeMembersEndpoint.throwIfInvalidBody(body);

        const queueId = 'charge-members-' + organization.id;

        if (QueueHandler.isRunning(queueId)) {
            throw new SimpleError({
                code: 'charge_pending',
                message: 'Charge members already pending',
                human: $t(`d2b84fdd-035b-4307-a897-000081aa814f`),
            });
        }

        await QueueHandler.schedule(queueId, async () => {
            const dataGenerator = fetchToAsyncIterator(new LimitedFilteredRequest({
                filter: body.filter,
                limit: 100,
            }), {
                fetch: request => GetMembersEndpoint.buildData(request, PermissionLevel.Write),
            });

            for await (const data of dataGenerator) {
                await MemberCharger.chargeMany({
                    chargingOrganizationId: organization.id,
                    membersToCharge: data.members,
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
