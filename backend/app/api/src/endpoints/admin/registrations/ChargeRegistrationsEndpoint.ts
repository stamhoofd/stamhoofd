import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { ChargeRequest, LimitedFilteredRequest, PermissionLevel } from '@stamhoofd/structures';

import { QueueHandler } from '@stamhoofd/queues';
import { Context } from '../../../helpers/Context.js';
import { fetchToAsyncIterator } from '../../../helpers/fetchToAsyncIterator.js';
import { MemberCharger } from '../../../helpers/MemberCharger.js';
import { GetRegistrationsEndpoint } from '../../global/registration/GetRegistrationsEndpoint.js';
import { ChargeMembersEndpoint } from '../members/ChargeMembersEndpoint.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = ChargeRequest;
type ResponseBody = undefined;

export class ChargeRegistrationsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = ChargeRequest as Decoder<ChargeRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/admin/charge-registrations', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        const body = request.body;

        await Context.authenticate();

        if (!await Context.auth.canManagePayments(organization.id)) {
            throw Context.auth.error();
        }

        ChargeMembersEndpoint.throwIfInvalidBody(body);

        const queueId = 'charge-registrations-' + organization.id;

        if (QueueHandler.isRunning(queueId)) {
            throw new SimpleError({
                code: 'charge_pending',
                message: 'Charge registrations already pending',
                human: $t(`d2b84fdd-035b-4307-a897-000081aa814f`),
            });
        }

        await QueueHandler.schedule(queueId, async () => {
            const dataGenerator = fetchToAsyncIterator(new LimitedFilteredRequest({
                filter: body.filter,
                limit: 100,
            }), {
                fetch: request => GetRegistrationsEndpoint.buildData(request, PermissionLevel.Write),
            });

            const chargedMemberIds = new Set<string>();

            for await (const data of dataGenerator) {
                for (const registration of data.registrations) {
                    const memberId = registration.member.id;

                    // only charge members once
                    if (!chargedMemberIds.has(memberId)) {
                        chargedMemberIds.add(memberId);
                        await MemberCharger.charge({
                            chargingOrganizationId: organization.id,
                            memberToCharge: registration.member,
                            price: body.price,
                            amount: body.amount ?? 1,
                            description: body.description,
                            dueAt: body.dueAt,
                            createdAt: body.createdAt,
                        });
                    }
                }
            }
        });

        return new Response(undefined);
    }
}
