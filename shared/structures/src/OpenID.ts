import { AutoEncoder, EnumDecoder, field, StringDecoder } from "@simonbackx/simple-encoding";

import { LoginProviderType } from "./User";

export class OpenIDClientConfiguration extends AutoEncoder {
    @field({decoder: StringDecoder})
    issuer = '';

    @field({decoder: StringDecoder})
    clientId = ''

    @field({decoder: StringDecoder})
    clientSecret = ''

    static get placeholderClientSecret() {
        return '••••';
    }
}


export class StartOpenIDFlowStruct extends AutoEncoder {
    @field({ decoder: StringDecoder, optional: true, nullable: true })
    webshopId: string | null = null;

    @field({ decoder: StringDecoder })
    organizationId: string;

    /**
     * To secure the final redirect (not for the openid connect flow itself)
     */
    @field({ decoder: StringDecoder })
    spaState: string;

    /**
     * sso (= use one configured in organization), google, apple, ... (for now only sso supported)
     */
    @field({ decoder: new EnumDecoder(LoginProviderType) })
    provider = LoginProviderType.SSO

    /**
     * sso (= use one configured in organization), google, apple, ... (for now only sso supported)
     */
    @field({ decoder: StringDecoder, optional: true, nullable: true })
    prompt: string | null = null

    @field({ decoder: StringDecoder, optional: true, nullable: true })
    redirectUri: string | null = null
}