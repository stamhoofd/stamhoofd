import { Response, Request, RequestMiddleware, ResponseMiddleware } from '@simonbackx/simple-endpoints';
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { Version } from '@stamhoofd/structures';

export class VersionMiddleware implements RequestMiddleware, ResponseMiddleware {
    minimumVersion: number | undefined;
    latestVersions: { android: number; ios: number; web: number };

    constructor(options: { latestVersions: { android: number; ios: number; web: number }; minimumVersion?: number }) {
        this.minimumVersion = options.minimumVersion;
        this.latestVersions = options.latestVersions;
    }

    handleRequest(request: Request) {
        if (!this.minimumVersion) {
            return;
        }

        const platform = request.headers['x-platform'];

        let version!: number;

        try {
            version = request.getVersion();
        }
        catch (e) {
            if ((isSimpleError(e) || isSimpleErrors(e)) && e.hasCode('missing_version')) {
                // Allow missing version on /openid/ path
                if (STAMHOOFD.environment === 'development' || request.url.startsWith('/openid/')) {
                    request.version = this.latestVersions.web;
                    return;
                }
            }
            throw e;
        }

        /* if (request.getIP() === '') {
            throw new SimpleError({
                code: "blocked",
                statusCode: 400,
                message: "Temporary blocked",
                human: "Jouw verbinding is tijdelijk geblokkeerd. Gelieve contact op te nemen met hallo@stamhoofd.be"
            })
        } */

        if (version < this.minimumVersion) {
            // WARNING: update caddy config for on demand certificates, because we don't want to throw errors over there!
            if (platform === 'web' || platform === undefined) {
                throw new SimpleError({
                    code: 'client_update_required',
                    statusCode: 400,
                    message: 'Er is een noodzakelijke update beschikbaar. Herlaad de pagina en wis indien nodig de cache van jouw browser.',
                    human: $t(`adb0e7c8-aed7-43f5-bfcc-a350f03aaabe`),
                });
            }
            else {
                throw new SimpleError({
                    code: 'client_update_required',
                    statusCode: 400,
                    message: 'Er is een noodzakelijke update beschikbaar. Update de app en probeer opnieuw!',
                    human: $t(`81f98449-1a82-4cd3-bde3-16bb58f75fb1`),
                });
            }
        }
    }

    handleResponse(request: Request, response: Response) {
        const platform = request.headers['x-platform'];

        if (platform === 'android') {
            response.headers['X-Platform-Latest-Version'] = this.latestVersions.android;
        }
        if (platform === 'ios') {
            response.headers['X-Platform-Latest-Version'] = this.latestVersions.ios;
        }
        if (platform === 'web') {
            response.headers['X-Platform-Latest-Version'] = this.latestVersions.web;
        }

        try {
            response.headers['X-Version'] = Math.min(Version, request.getVersion());
        }
        catch (e) {
            // No version provided or invalid version
        }
    }
}
