import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { Country } from '@stamhoofd/structures';

import { Geolocator } from '../classes/Geolocator.js';

type Params = Record<string, never>;
type Body = undefined;
type Query = undefined;
type ResponseBody = string;

function getRequestIP(request: Request): string {
    let ipAddress = request.request?.socket.remoteAddress;
    if (request.headers['x-real-ip'] && typeof request.headers['x-real-ip'] === 'string' && (ipAddress === '127.0.0.1' || ipAddress === '0.0.0.0')) {
        ipAddress = request.headers['x-real-ip'];
    }
    if (!ipAddress) {
        ipAddress = '?';
    }

    return ipAddress.split(':', 2)[0];
}

export class RedirectEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(_request: Request): [true, Params] | [false] {
        return [true, {}];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const ip = getRequestIP(request.request);

        const country = Geolocator.shared.getCountry(ip);

        const path = request.request.request?.url ?? '';

        if (country === Country.Belgium) {
            const url = 'https://www.stamhoofd.be' + path;
            const response = new Response($t(`3fb0eda2-63e8-422c-a19f-b36c36bea5eb`) + ' ' + url);
            response.status = 302;
            response.headers['Location'] = url;

            // Prevent encoding and version requirement
            response.headers['Content-Type'] = 'text/html';
            return Promise.resolve(response);
        }

        const url = 'https://www.stamhoofd.nl' + path;
        const response = new Response($t(`3fb0eda2-63e8-422c-a19f-b36c36bea5eb`) + ' ' + url);
        response.status = 302;
        response.headers['Location'] = url;

        // Prevent encoding and version requirement
        response.headers['Content-Type'] = 'text/html';
        return Promise.resolve(response);
    }
}
