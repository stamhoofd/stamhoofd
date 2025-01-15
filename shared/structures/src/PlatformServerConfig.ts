import { AutoEncoder, field } from '@simonbackx/simple-encoding';
import { OpenIDClientConfiguration } from './OpenID';

export class PlatformServerConfig extends AutoEncoder {
    @field({ decoder: OpenIDClientConfiguration, nullable: true })
    ssoConfiguration: OpenIDClientConfiguration | null = null;
}
