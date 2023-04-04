import { AutoEncoder, field, StringDecoder } from "@simonbackx/simple-encoding";

export class OpenIDClientConfiguration extends AutoEncoder {
    @field({decoder: StringDecoder})
    issuer: string

    @field({decoder: StringDecoder})
    clientId

    @field({decoder: StringDecoder})
    clientSecret
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
    @field({ decoder: StringDecoder })
    client = "sso"

    /**
     * sso (= use one configured in organization), google, apple, ... (for now only sso supported)
     */
    @field({ decoder: StringDecoder, optional: true, nullable: true })
    prompt: string | null = null

    @field({ decoder: StringDecoder, optional: true, nullable: true })
    redirectUri: string | null = null
}