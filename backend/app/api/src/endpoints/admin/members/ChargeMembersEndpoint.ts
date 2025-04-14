import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { ChargeMembersRequest, LimitedFilteredRequest, PermissionLevel } from '@stamhoofd/structures';

import { QueueHandler } from '@stamhoofd/queues';
import { Context } from '../../../helpers/Context';
import { fetchToAsyncIterator } from '../../../helpers/fetchToAsyncIterator';
import { MemberCharger } from '../../../helpers/MemberCharger';
import { GetMembersEndpoint } from '../../global/members/GetMembersEndpoint';

type Params = Record<string, never>;
type Query = LimitedFilteredRequest;
type Body = ChargeMembersRequest;
type ResponseBody = undefined;

export class ChargeMembersEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = LimitedFilteredRequest as Decoder<LimitedFilteredRequest>;
    bodyDecoder = ChargeMembersRequest as Decoder<ChargeMembersRequest>;

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

    private static throwIfInvalidBody(body: Body) {
        if (!body.description?.trim()?.length) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Invalid description',
                human: $t(`Beschrijving is verplicht`),
                field: 'description',
            });
        }

        if (!body.price) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Invalid price',
                human: $t(`Bedrag kan niet 0 zijn`),
                field: 'price',
            });
        }

        if (body.amount === 0) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Invalid amount',
                human: $t(`Aantal kan niet 0 zijn`),
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

        const queueId = 'charge-members';

        if (QueueHandler.isRunning(queueId)) {
            throw new SimpleError({
                code: 'charge_pending',
                message: 'Charge members already pending',
                human: $t(`Er is al een aanrekening bezig, even geduld.`),
            });
        }

        await QueueHandler.schedule(queueId, async () => {
            const dataGenerator = fetchToAsyncIterator(request.query, {
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
