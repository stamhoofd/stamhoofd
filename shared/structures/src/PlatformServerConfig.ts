import { AutoEncoder, field } from '@simonbackx/simple-encoding';
import { OpenIDClientConfiguration } from './OpenID.js';

export class PlatformServerConfig extends AutoEncoder {
    @field({ decoder: OpenIDClientConfiguration, nullable: true, version: 360 })
    ssoConfiguration: OpenIDClientConfiguration | null = null;

    @field({ decoder: OpenIDClientConfiguration, nullable: true, version: 360 })
    googleConfiguration: OpenIDClientConfiguration | null = null;
}
