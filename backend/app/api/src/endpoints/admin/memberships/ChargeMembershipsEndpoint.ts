import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { QueueHandler } from '@stamhoofd/queues';
import { sleep } from '@stamhoofd/utility';
import { Context } from '../../../helpers/Context';


type Params = Record<string, never>;
type Query = Record<string, never>;
type Body = undefined;
type ResponseBody = undefined;

export class ChargeMembershipsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/admin/charge-memberships", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.authenticate()

        if (!Context.auth.hasPlatformFullAccess()) {
            throw Context.auth.error()
        }

        QueueHandler.schedule('charge-memberships', async () => {
            // todo
            await sleep(15 * 1000)
        }).catch(console.error);
       
        return new Response(undefined);
    }
}
