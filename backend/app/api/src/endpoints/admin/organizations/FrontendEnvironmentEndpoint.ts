import {
    DecodedRequest,
    Endpoint,
    Request,
    Response,
} from '@simonbackx/simple-endpoints';
import { Version } from '@stamhoofd/structures';

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined;
type ResponseBody = string;

// todo: move
export class FrontendEnvironmentEndpoint extends Endpoint<
    Params,
    Query,
    Body,
    ResponseBody
> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        // if (request.method !== 'GET') {
        //     return [false];
        // }

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
        // todo: this is only a test
        const frontendEnvironment: FrontendEnvironment = {
            // shared
            environment: STAMHOOFD.environment,
            domains: STAMHOOFD.domains,
            locales: STAMHOOFD.locales,
            userMode: STAMHOOFD.userMode,
            translationNamespace: STAMHOOFD.translationNamespace,
            platformName: STAMHOOFD.platformName,
            fixedCountry: STAMHOOFD.fixedCountry,
            singleOrganization: STAMHOOFD.singleOrganization,

            // frontend specific
            PORT: STAMHOOFD.PORT,
            VERSION: Version.toString(),
            MOLLIE_CLIENT_ID: STAMHOOFD.MOLLIE_CLIENT_ID,

            // readonly NOLT_URL?: string
            // readonly FEEDBACK_URL?: string
            // readonly MOLLIE_CLIENT_ID: string
            // readonly APP_UPDATE_SERVER_URL?: string

            // // Switching envs
            // readonly APP_UPDATE_PRODUCTION_SERVER_URL?: string
            // readonly APP_UPDATE_STAGING_SERVER_URL?: string
            // readonly APP_UPDATE_DEVELOPMENT_SERVER_URL?: string

            // readonly CHANGELOG_URL?: Localized<`https://${string}`>

            // readonly ILLUSTRATIONS_NAMESPACE?: string // A subfolder of 'illustrations' will be used for illustrations (if the illustration exists)
            // readonly ILLUSTRATIONS_COLORS?: Record<string, `#${string}`>
            // readonly PLAUSIBLE_DOMAIN?: string

            // /**
            //  * Redirect users that are not logged in to this domain (maintaining the same path)
            //  */
            // readonly REDIRECT_LOGIN_DOMAIN?: string

            // /**
            //  * Custom documentation page for members
            //  */
            // readonly memberDocumentationPage?: LanguageMap,

        };

        const json = JSON.stringify(frontendEnvironment);
        const code = `window.STAMHOOFD = ${json};`;
        const response = new Response(code);
        response.status = 200;
        response.headers['Content-Type'] = 'application/javascript';
        return response;
    }
}
