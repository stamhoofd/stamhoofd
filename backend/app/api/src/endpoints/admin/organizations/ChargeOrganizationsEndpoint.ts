import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { ChargeOrganizationsRequest, LimitedFilteredRequest, Organization as OrganizationStruct } from '@stamhoofd/structures';

import { QueueHandler } from '@stamhoofd/queues';
import { Context } from '../../../helpers/Context';
import { fetchToAsyncIterator } from '../../../helpers/fetchToAsyncIterator';
import { OrganizationCharger } from '../../../helpers/OrganizationCharger';
import { GetOrganizationsEndpoint } from './GetOrganizationsEndpoint';

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
                human: 'Beschrijving is verplicht',
                field: 'description',
            });
        }

        if (!body.price) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Invalid price',
                human: 'Bedrag kan niet 0 zijn',
                field: 'price',
            });
        }

        if (body.amount === 0) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Invalid amount',
                human: 'Aantal kan niet 0 zijn',
                field: 'amount',
            });
        }

        if (body.organizationId === undefined) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Invalid organization id',
                human: 'Organisatie is verplicht',
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
                human: 'Er is al een aanrekening bezig, even geduld.',
            });
        }

        await QueueHandler.schedule(queueId, async () => {
            const dataGenerator = fetchToAsyncIterator(request.query, {
                fetch: GetOrganizationsEndpoint.buildData,
            });

            const organizationId = body.organizationId;
            const chargeOrganizations = organizationId === null
                ? OrganizationCharger.chargeFromPlatform
                : (args: { organizationsToCharge: OrganizationStruct[]; price: number; amount?: number; description: string }) => OrganizationCharger.chargeMany({
                        chargingOrganizationId: organizationId,
                        ...args });

            for await (const data of dataGenerator) {
                await chargeOrganizations({
                    organizationsToCharge: data,
                    price: body.price,
                    amount: body.amount ?? 1,
                    description: body.description,
                });
            }
        });

        return new Response(undefined);
    }
}
