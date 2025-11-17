import {
    DecodedRequest,
    Endpoint,
    Request,
    Response,
} from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';

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
        if (STAMHOOFD.EXPOSE_FRONTEND_ENVIRONMENT === undefined) {
            throw new SimpleError({
                code: 'environment_missing',
                message: 'The frontend environment is not exposed in the current environment',
            });
        }

        const code = `window.STAMHOOFD = ${JSON.stringify(STAMHOOFD.EXPOSE_FRONTEND_ENVIRONMENT)};`;
        const response = new Response(code);
        response.status = 200;
        response.headers['Content-Type'] = 'application/javascript';
        return response;
    }
}
