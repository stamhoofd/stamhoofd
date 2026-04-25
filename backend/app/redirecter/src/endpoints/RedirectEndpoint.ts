import type { DecodedRequest, Request} from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { Country } from '@stamhoofd/types/Country';
import { Geolocator } from '../classes/Geolocator.js';

type Params = Record<string, never>;
type Body = undefined;
type Query = undefined;
type ResponseBody = string;

export class RedirectEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(_request: Request): [true, Params] | [false] {
        return [true, {}];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const ip = request.request.getIP()

        const country = Geolocator.shared.getCountry(ip);

        const path = request.request.request?.url ?? '';

        if (country === Country.Belgium) {
            const url = 'https://www.stamhoofd.be' + path;
            const response = new Response($t(`%G3`) + ' ' + url);
            response.status = 302;
            response.headers['Location'] = url;

            // Prevent encoding and version requirement
            response.headers['Content-Type'] = 'text/html';
            return Promise.resolve(response);
        }

        const url = 'https://www.stamhoofd.nl' + path;
        const response = new Response($t(`%G3`) + ' ' + url);
        response.status = 302;
        response.headers['Location'] = url;

        // Prevent encoding and version requirement
        response.headers['Content-Type'] = 'text/html';
        return Promise.resolve(response);
    }
}
