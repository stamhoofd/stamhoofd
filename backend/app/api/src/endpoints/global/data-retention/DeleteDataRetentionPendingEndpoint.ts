import type { DecodedRequest, Request } from '@node/endpoints';
import { Endpoint, Response } from '@node/endpoints';
import { SimpleError } from '@common/errors';
import type { DataRetentionSettings } from '@stamhoofd/structures';
import { isDataRetentionCategory } from '@stamhoofd/structures';

import { DataRetentionPolicyService } from '../../../services/data-retention/DataRetentionPolicyService.js';

type Params = { category: string };
type Query = undefined;
type Body = undefined;
type ResponseBody = DataRetentionSettings;

export class DeleteDataRetentionPendingEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'DELETE') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/data-retention/pending/@category', { category: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const { organization, user } = await DataRetentionPolicyService.authenticate({ fresh: false });

        const { category } = request.params;
        if (!isDataRetentionCategory(category)) {
            throw new SimpleError({
                code: 'invalid_field',
                field: 'category',
                message: 'Unknown category',
            });
        }

        await DataRetentionPolicyService.cancelPendingChange(organization, user, category);
        return new Response(await DataRetentionPolicyService.getSettings(organization));
    }
}
