import type { Decoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { TranslateRequest, TranslateResponse } from '@stamhoofd/structures/endpoints/TranslateRequest.js';

import { Context } from '../../../helpers/Context.js';
import { TranslationService } from '../../../services/TranslationService.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = TranslateRequest;
type ResponseBody = TranslateResponse;

export class TranslateEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = TranslateRequest as Decoder<TranslateRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/translate', {});

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

        if (request.body.inputs.size === 0) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'At least one input is required',
                human: $t('%Znx'),
                field: 'inputs',
            });
        }

        if (request.body.targetLanguages.length === 0) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'At least one target language is required',
                human: $t('%Znt'),
                field: 'targetLanguages',
            });
        }

        const translations = await TranslationService.translate({
            inputs: request.body.inputs,
            sourceLanguage: request.body.sourceLanguage,
            targetLanguages: request.body.targetLanguages,
            context: request.body.context,
        });

        return new Response(TranslateResponse.create({ translations }));
    }
}
