import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { UitpasClientCredentialsStatus, UitpasClientIdAndSecret, UitpasSetClientCredentialsResponse } from '@stamhoofd/structures';
import { Organization, Platform } from '@stamhoofd/models';
import { Context } from '../../../helpers/Context';
import { UitpasService } from '../../../services/uitpas/UitpasService';

type Params = Record<string, never>;
type Query = undefined;
type Body = UitpasClientIdAndSecret;
type ResponseBody = UitpasSetClientCredentialsResponse;

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class SetUitpasClientCredentialsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = UitpasClientIdAndSecret as Decoder<UitpasClientIdAndSecret>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/uitpas/client-credentials', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization: Organization | null = await Context.setOptionalOrganizationScope();
        await Context.authenticate();

        let modal: Organization | Platform;
        let orgId: string | null; // null for platform

        const body = request.body;

        if (organization) {
            if (!await Context.auth.hasFullAccess(organization.id)) {
                throw Context.auth.error();
            }
            orgId = organization.id;
            modal = organization;
        }
        else {
            if (!Context.auth.hasPlatformFullAccess()) {
                throw Context.auth.error();
            }
            orgId = null;
            modal = await Platform.getForEditing();
        }
        const submodal = modal instanceof Organization
            ? modal.meta
            : modal.config;

        if (body.clientId === '' && body.clientSecret === '') {
            // clear
            await UitpasService.clearClientCredentialsFor(orgId);
            submodal.uitpasClientCredentialsStatus = UitpasClientCredentialsStatus.NotConfigured;
            await modal.save();
            const resp = new UitpasSetClientCredentialsResponse();
            resp.status = UitpasClientCredentialsStatus.NotConfigured;
            return new Response(resp);
        }

        if (organization && !organization.meta.uitpasOrganizerId) {
            throw new SimpleError({
                message: 'This organization does not have a uitpas organizer id set',
                code: 'missing_uitpas_organizer_id',
                human: $t('Stel eerst een UiTPAS-organisator in.'),
            });
        }

        else if (body.clientId === '' || body.clientSecret === '') {
            throw new SimpleError({
                message: 'You must provide the client id and client secret',
                code: 'missing_client_credential',
                human: $t('Je moet een {missingField} opgeven.', { missingField: body.clientId === '' ? 'client id' : 'client secret' }),
                field: body.clientId === '' ? 'clientId' : 'clientSecret',
            });
        }

        const { clientId, useTestEnv } = await UitpasService.getClientIdFor(orgId);

        const reEvaluation = body.clientSecret === UitpasClientIdAndSecret.placeholderClientSecret;

        // store the client credentials and store new status in one operation
        if (!reEvaluation) {
            const valid = await UitpasService.storeIfValid(orgId, body.clientId, body.clientSecret, body.useTestEnv);
            if (!valid) {
                throw new SimpleError({
                    message: 'The provided client credentials are not valid',
                    code: 'invalid_client_credentials',
                    human: $t('De opgegeven client credentials zijn niet geldig.'),
                });
            }
        }
        else if (useTestEnv !== body.useTestEnv || clientId !== body.clientId) {
            // re-evaluate, but on other environment
            const valid = await UitpasService.updateIfValid(orgId, body.clientId, body.useTestEnv);
            if (!valid) {
                throw new SimpleError({
                    message: 'The provided client credentials are not valid for the selected environment',
                    code: 'invalid_client_credentials_for_env',
                    human: body.useTestEnv ? $t('De opgegeven client credentials zijn niet geldig voor de testomgeving van UiTPAS.') : $t('De opgegeven client credentials zijn niet geldig.'),
                });
            }
        }

        submodal.uitpasClientCredentialsStatus = UitpasClientCredentialsStatus.NotChecked;
        await modal.save();

        const { status, human } = await UitpasService.checkPermissionsFor(orgId, organization?.meta.uitpasOrganizerId ?? undefined);

        // now we update the status (but if this fails, the status will safely remain NOT_CHECKED)
        submodal.uitpasClientCredentialsStatus = status;
        await modal.save();

        const resp = new UitpasSetClientCredentialsResponse();
        resp.status = status;
        resp.human = human;
        return new Response(resp);
    }
}
