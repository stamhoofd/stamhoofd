import type { DecodedRequest, Request } from '@node/endpoints';
import { Endpoint, Response } from '@node/endpoints';
import type { DataRetentionSettings } from '@stamhoofd/structures';

import { DataRetentionPolicyService } from '../../../services/data-retention/DataRetentionPolicyService.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined;
type ResponseBody = DataRetentionSettings;

export class GetDataRetentionEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/data-retention', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(_: DecodedRequest<Params, Query, Body>) {
        const { organization } = await DataRetentionPolicyService.authenticate({ fresh: false });
        return new Response(await DataRetentionPolicyService.getSettings(organization));
    }
}
