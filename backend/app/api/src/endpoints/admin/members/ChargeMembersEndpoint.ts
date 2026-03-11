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
                human: $t(`%Cr`),
                field: 'description',
            });
        }

        if (!body.price) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Invalid price',
                human: $t(`%Cs`),
                field: 'price',
            });
        }

        if (body.amount === 0) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Invalid amount',
                human: $t(`%Ct`),
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
                human: $t(`%Cu`),
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
