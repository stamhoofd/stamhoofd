import type { Decoder } from '@common/encoding';
import type { DecodedRequest, Request } from '@node/endpoints';
import { Endpoint, Response } from '@node/endpoints';
import type { DataRetentionPreview } from '@stamhoofd/structures';
import { DataRetentionPolicyUpdate } from '@stamhoofd/structures';

import { DataRetentionPolicyService } from '../../../services/data-retention/DataRetentionPolicyService.js';
import { DataRetentionPreviewService } from '../../../services/data-retention/DataRetentionPreviewService.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = DataRetentionPolicyUpdate;
type ResponseBody = DataRetentionPreview;

/**
 * How long the count may take before the confirmation is shown without numbers.
 */
const MAX_DURATION = 5 * 1000;

/**
 * Counts what terms would do before they are saved. Needs no fresh authentication, because it does not change anything.
 */
export class PostDataRetentionPreviewEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = DataRetentionPolicyUpdate as Decoder<DataRetentionPolicyUpdate>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/data-retention/preview', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const { organization } = await DataRetentionPolicyService.authenticate({ fresh: false });
        return new Response(
            await DataRetentionPreviewService.preview(
                organization,
                request.body.category,
                request.body.terms,
                new Date(Date.now() + MAX_DURATION),
            ),
        );
    }
}
