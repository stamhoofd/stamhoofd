import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import type { Platform as PlatformStruct } from '@stamhoofd/structures';

import { Context } from '../../../helpers/Context.js';
import { TenantContext } from '../../../helpers/TenantContext.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined;
type ResponseBody = PlatformStruct;

export class GetPlatformEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        // /tenant is the canonical name. /platform stays forever: cached web apps and installed
        // mobile apps keep asking for it.
        for (const path of ['/tenant', '/platform']) {
            const params = Endpoint.parseParameters(request.url, path, {});

            if (params) {
                return [true, params as Params];
            }
        }
        return [false];
    }

    async handle(_: DecodedRequest<Params, Query, Body>) {
        await Context.setOptionalOrganizationScope({ willAuthenticate: true });
        await Context.optionalAuthenticate({ allowWithoutAccount: false });

        if (Context.optionalAuth?.hasSomePlatformAccess()) {
            const platform = await TenantContext.current.getPrivateStruct();
            if (!platform.privateConfig) {
                throw new Error('Private config not found');
            }
            return new Response(platform);
        }
        const platform = await TenantContext.current.getStruct();
        return new Response(platform);
    }
}
