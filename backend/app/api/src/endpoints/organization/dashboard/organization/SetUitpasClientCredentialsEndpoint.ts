import { AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { UitpasClientCredentialsStatus, UitpasClientIdAndSecret, UitpasSetClientCredentialsResponse } from '@stamhoofd/structures';
import { Context } from '../../../../helpers/Context.js';
import { UitpasService } from '../../../../services/uitpas/UitpasService.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = AutoEncoderPatchType<UitpasClientIdAndSecret>;
type ResponseBody = UitpasSetClientCredentialsResponse;

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class SetUitpasClientCredentialsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = UitpasClientIdAndSecret.patchType() as Decoder<AutoEncoderPatchType<UitpasClientIdAndSecret>>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/organization/uitpas-client-credentials', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate();

        if (!await Context.auth.hasFullAccess(organization.id)) {
            throw Context.auth.error();
        }

        if (request.body.clientId === '' && request.body.clientSecret === '') {
            // clear
            await UitpasService.clearClientCredentialsFor(organization.id);
            organization.meta.uitpasClientCredentialsStatus = UitpasClientCredentialsStatus.NotConfigured;
            await organization.save();
            const resp = new UitpasSetClientCredentialsResponse();
            resp.status = UitpasClientCredentialsStatus.NotConfigured;
            return new Response(resp);
        }
        if (!request.body.clientId) {
            throw new SimpleError({
                message: 'You must provide a client id',
                code: 'missing_client_id',
                human: $t('9b9ec483-63b8-4696-ade6-0eb18f9008e6'),
                field: 'clientId',
            });
        }
        if (!request.body.clientSecret) {
            throw new SimpleError({
                message: 'You must provide a client secret',
                code: 'missing_client_secret',
                human: $t('58de00fb-3b0a-45a6-9214-7d11b4175779'),
                field: 'clientSecret',
            });
        }
        if (request.body.clientSecret === UitpasClientIdAndSecret.placeholderClientSecret && (await UitpasService.getClientIdFor(organization.id)) !== request.body.clientId) {
            throw new SimpleError({
                message: 'You cannot use the placeholder client secret for a different client id',
                code: 'invalid_client_secret',
                human: $t('bbc79280-7ae2-4b8d-a900-2d7cbb552428'),
                field: 'clientSecret',
            });
        }
        const reEvaluation = request.body.clientSecret === UitpasClientIdAndSecret.placeholderClientSecret;

        if (!organization.meta.uitpasOrganizerId) {
            throw new SimpleError({
                message: 'This organization does not have a uitpas organizer id set',
                code: 'missing_uitpas_organizer_id',
                human: $t('80fcde9c-c8c7-4fe1-b9a6-51684a23d850'),
            });
        }

        // store the client credentials and store new status in one operation
        if (!reEvaluation) {
            const valid = await UitpasService.storeIfValid(organization.id, request.body.clientId, request.body.clientSecret);
            if (!valid) {
                throw new SimpleError({
                    message: 'The provided client credentials are not valid',
                    code: 'invalid_client_credentials',
                    human: $t('42bbd5c0-8789-4ca1-b667-1c9ecf4d0190'),
                });
            }
        }
        organization.meta.uitpasClientCredentialsStatus = UitpasClientCredentialsStatus.NotChecked;
        await organization.save();

        // now we update the status (but if this fails, the status will safely remain NOT_CHECKED)
        const { status, human } = await UitpasService.checkPermissionsFor(organization.id, organization.meta.uitpasOrganizerId);
        organization.meta.uitpasClientCredentialsStatus = status;
        await organization.save(); // save the organization to update the status

        const resp = new UitpasSetClientCredentialsResponse();
        resp.status = status;
        resp.human = human;
        return new Response(resp);
    }
}
