import {
    DecodedRequest,
    Endpoint,
    Request,
    Response,
} from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Version } from '@stamhoofd/structures';

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined;
type ResponseBody = string;

export class FrontendEnvironmentEndpoint extends Endpoint<
    Params,
    Query,
    Body,
    ResponseBody
> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        if (STAMHOOFD.environment !== 'test') {
            // Disallow exposing environments outside of tests (even in development!)
            return [false];
        }

        const params = Endpoint.parseParameters(
            request.url,
            '/frontend-environment',
            {},
        );

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(_request: DecodedRequest<Params, Query, Body>) {
        const env: SharedEnvironment = {
            environment: STAMHOOFD.environment,
            domains: STAMHOOFD.domains,
            locales: STAMHOOFD.locales,
            userMode: STAMHOOFD.userMode,
            translationNamespace: STAMHOOFD.translationNamespace,
            platformName: STAMHOOFD.platformName,
            fixedCountry: STAMHOOFD.fixedCountry,
            singleOrganization: STAMHOOFD.singleOrganization,
        };

        const frontendEnv: FrontendSpecificEnvironment = {
            VERSION: '0.0.0',
            MOLLIE_CLIENT_ID: '',
        };

        // Load keys that could be defined in STAMHOOFD, but where typescript will complain about because the server
        // normally does not have access to this. Playwright is the exception where it is possible.
        const keys: (keyof FrontendSpecificEnvironment)[] = [
            'PORT',
            'VERSION',
            'NOLT_URL',
            'FEEDBACK_URL',
            'MOLLIE_CLIENT_ID',
            'APP_UPDATE_SERVER_URL',
            'APP_UPDATE_PRODUCTION_SERVER_URL',
            'APP_UPDATE_STAGING_SERVER_URL',
            'APP_UPDATE_DEVELOPMENT_SERVER_URL',
            'CHANGELOG_URL',
            'ILLUSTRATIONS_NAMESPACE',
            'ILLUSTRATIONS_COLORS',
            'PLAUSIBLE_DOMAIN',
            'REDIRECT_LOGIN_DOMAIN',
            'memberDocumentationPage',
        ];
        for (const key of keys) {
            (frontendEnv as any)[key] = (STAMHOOFD as any)[key];
        }

        const code = `window.STAMHOOFD = ${JSON.stringify({ ...env, ...frontendEnv })};`;
        const response = new Response(code);
        response.status = 200;
        response.headers['Content-Type'] = 'application/javascript';
        return response;
    }
}
