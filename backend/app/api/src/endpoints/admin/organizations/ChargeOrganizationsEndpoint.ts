import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { LimitedFilteredRequest } from '@stamhoofd/structures';

import { QueueHandler } from '@stamhoofd/queues';
import { Context } from '../../../helpers/Context';
import { fetchToAsyncIterator } from '../../../helpers/fetchToAsyncIterator';
import { GetOrganizationsEndpoint } from './GetOrganizationsEndpoint';

type Params = Record<string, never>;
type Query = LimitedFilteredRequest;
type Body = undefined;
type ResponseBody = string;

export class ChargeOrganizationsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = LimitedFilteredRequest as Decoder<LimitedFilteredRequest>;

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
        await Context.authenticate();

        if (!Context.auth.hasPlatformFullAccess()) {
            throw Context.auth.error();
        }

        const queueId = 'charge-organizations';

        if (QueueHandler.isRunning(queueId)) {
            throw new SimpleError({
                code: 'charge_pending',
                message: 'Charge organizations already pending',
                human: 'Er is al een aanrekening bezig, even geduld.',
            });
        }

        let countTest: number = 0;

        await QueueHandler.schedule(queueId, async () => {
            const dataGenerator = fetchToAsyncIterator(request.query, {
                fetch: GetOrganizationsEndpoint.buildData,
            });

            for await (const data of dataGenerator) {
                // todo;
                countTest = countTest + data.length;
            }
        });

        return new Response(countTest.toString());
    }
}
