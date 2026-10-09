import type { AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { MailchimpSettings } from '@stamhoofd/structures/mailchimp/MailchimpSettings.js';
import { MailchimpService } from '../../../../services/mailchimp/MailchimpService.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = AutoEncoderPatchType<MailchimpSettings>;
type ResponseBody = MailchimpSettings;

/**
 * Changes the audience and the records used for consent and tags. Account details can only change by connecting again.
 */
export class PatchMailchimpSettingsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = MailchimpSettings.patchType() as Decoder<AutoEncoderPatchType<MailchimpSettings>>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'PATCH') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/mailchimp/settings', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const { organization } = await MailchimpService.authenticate();
        return new Response(await MailchimpService.patchSettings(organization, request.body));
    }
}
