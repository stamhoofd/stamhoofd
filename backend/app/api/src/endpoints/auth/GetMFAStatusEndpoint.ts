import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import type { MFAStatus } from '@stamhoofd/structures';

import { Context } from '../../helpers/Context.js';
import { TwoFactorHelper } from '../../helpers/TwoFactorHelper.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined;
type ResponseBody = MFAStatus;

export class GetMFAStatusEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }
        const params = Endpoint.parseParameters(request.url, '/mfa', {});
        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.setOptionalOrganizationScope();
        const { user } = await Context.authenticate({ allowWithoutAccount: true, allowUnscoped: true });

        return new Response(await TwoFactorHelper.buildStatus(user.id));
    }
}
