import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Platform, Webshop } from '@stamhoofd/models';
import { OpenIDClientConfiguration, StartOpenIDFlowStruct } from '@stamhoofd/structures';

import { Context } from '../../helpers/Context';
import { OpenIDConnectHelper } from '../../helpers/OpenIDConnectHelper';

type Params = Record<string, never>;
type Query = undefined;
type Body = StartOpenIDFlowStruct;
type ResponseBody = undefined;

export class OpenIDConnectStartEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = StartOpenIDFlowStruct as Decoder<StartOpenIDFlowStruct>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/openid/start', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        // Check webshop and/or organization
        const organization = await Context.setOptionalOrganizationScope();
        const webshopId = request.body.webshopId;
        const platform = await Platform.getShared();

        // Host should match correctly
        let redirectUri = 'https://' + STAMHOOFD.domains.dashboard;

        if (organization) {
            redirectUri = 'https://' + organization.getHost();
        }

        // todo: also support the app as redirect uri using app schemes (could be required for mobile apps)

        if (webshopId) {
            if (!organization) {
                throw new SimpleError({
                    code: 'invalid_organization',
                    message: 'Organization required when specifying webshopId',
                    statusCode: 400,
                });
            }

            const webshop = await Webshop.getByID(webshopId);
            if (!webshop || webshop.organizationId !== organization.id) {
                throw new SimpleError({
                    code: 'invalid_webshop',
                    message: 'Invalid webshop',
                    statusCode: 400,
                });
            }
            redirectUri = 'https://' + webshop.setRelation(Webshop.organization, organization).getHost();
        }

        if (request.body.redirectUri) {
            try {
                const allowedHost = new URL(redirectUri);
                const givenUrl = new URL(request.body.redirectUri);

                if (allowedHost.host === givenUrl.host && givenUrl.protocol === 'https:') {
                    redirectUri = givenUrl.href;
                }
            }
            catch (e) {
                console.error('Invalid redirect uri', request.body.redirectUri);
            }
        }

        if (request.body.spaState.length < 10) {
            throw new SimpleError({
                code: 'invalid_state',
                message: 'Invalid state',
                statusCode: 400,
            });
        }

        let configuration: OpenIDClientConfiguration | null;

        if (organization) {
            configuration = organization.serverMeta.ssoConfiguration;
        }
        else {
            configuration = platform.serverConfig.ssoConfiguration;
        }

        if (!configuration) {
            throw new SimpleError({
                code: 'invalid_client',
                message: 'SSO not configured',
                statusCode: 400,
            });
        }
        const helper = new OpenIDConnectHelper(organization, configuration);
        return await helper.startAuthCodeFlow(redirectUri, request.body.provider, request.body.spaState, request.body.prompt);
    }
}
