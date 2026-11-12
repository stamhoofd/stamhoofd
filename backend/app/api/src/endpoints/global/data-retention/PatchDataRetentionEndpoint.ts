import type { Decoder } from '@common/encoding';
import type { DecodedRequest, Request } from '@node/endpoints';
import { Endpoint, Response } from '@node/endpoints';
import type { DataRetentionSettings } from '@stamhoofd/structures';
import { DataRetentionPolicyUpdate } from '@stamhoofd/structures';

import { DataRetentionPolicyService } from '../../../services/data-retention/DataRetentionPolicyService.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = DataRetentionPolicyUpdate;
type ResponseBody = DataRetentionSettings;

export class PatchDataRetentionEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = DataRetentionPolicyUpdate as Decoder<DataRetentionPolicyUpdate>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'PATCH') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/data-retention', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const { organization, user } = await DataRetentionPolicyService.authenticate({ fresh: true });
        await DataRetentionPolicyService.update(organization, user, request.body.category, request.body.terms);
        return new Response(await DataRetentionPolicyService.getSettings(organization));
    }
}
