import type jose from 'jose'

export { };

declare enum Country {
    Belgium = 'BE',
    Netherlands = 'NL',
    Luxembourg = 'LU',
    France = 'FR',
    Germany = 'DE',
    Sweden = 'SE',
    UnitedKingdom = 'GB',
    Switzerland = 'CH',
    Afghanistan = 'AF',
    CzechRepublic = 'CZ',
    UnitedStates = 'US',
    Austria = 'AT',
    Portugal = 'PT',
    Other = 'OTHER',
}

/**
 * Stamhoofd uses a global variable to store some configurations. We don't use process.env because we can only store 
 * strings into those files. And we need objects for our localized domains (different domains for each locale). 
 * Having to encode and decode those values would be inefficient.
 * 
 * So we use our own global configuration variable: STAMHOOFD. Available everywhere and contains 
 * other information depending on the environment (frontend/backend/shared). TypeScript will 
 * always suggest the possible keys.
 */
declare global {
    type Localized<T> = {
        readonly [k in Country]?: T;
    } & {
        /// default is reserved, so we need to use something else (an empty string)
        readonly "": T;
    };

    type LocalizedDomain = Localized<string>;
    type GlobalCountry = Country;
    const enum MemberNumberAlgorithm {
        KSA = 'KSA',
        Incremental = 'Incremental',
    }
    
    type StamhoofdDomains = {
        dashboard: string,                      // requires both www + non-www DNS record
        registration?: LocalizedDomain,         // Optional. Set to undefined for platforms. requires wildcard prefix DNS
        marketing: LocalizedDomain,             // main landing page (used for linking back to website, documentation...)
        documentation?: LocalizedDomain,        // main landing page (used for linking back to website, documentation...)
        webshop: LocalizedDomain,               // E.g. shop.stamhoofd.be
        legacyWebshop?: string,                 // In the past, webshops were hosted on a subdomain. This is deprecated, but the links should still work. E.g. stamhoofd.shop for *.stamhoofd.shop
        api: string,                            // requires wildcard prefix DNS
        rendererApi: string,

        // MX + SPF (both for email) + A record for webshops
        webshopCname: string,

        // MX + SPF (both for email) + A record for registration
        registrationCname: string,


        // Default email domain for emails sent from organizations
        defaultTransactionalEmail?: LocalizedDomain,
        defaultBroadcastEmail?: LocalizedDomain,
    }

    /** 
     * The environment that is available everywhere: frontend, backend and shared
     */ 
    type SharedEnvironment = {
        /**
         * We'll map the value of NODE_ENV to the corresponsing value. But staging value isn't valid for NODE_ENV, hence our own variable
         */
        readonly environment: "production" | "development" | "staging" | "test"
        readonly domains: StamhoofdDomains

        /**
         * organization = users are specific to one organization
         * platform = users are shared between organizations
         */
        readonly userMode: 'organization'|'platform'
        readonly translationNamespace: string
        readonly platformName: string
        readonly fixedCountry?: Country
    }

    /** 
     * The specific backend environment values, only available in the backend services
     */ 
    type BackendSpecificEnvironment = {
        // Database
        readonly PORT: number,

        // Mapped to process.env for dependencies
        readonly DB_HOST: string,
        readonly DB_USER: string,
        readonly DB_PASS: string,
        readonly DB_DATABASE: string
        readonly DB_CONNECTION_LIMIT?: number,

        // E-mail
        readonly SMTP_HOST: string,
        readonly SMTP_USERNAME: string,
        readonly SMTP_PASSWORD: string,
        readonly SMTP_PORT: number,
        readonly SMTP_HEADERS?: Record<string, string>,

        // E-mail (transactional e-mails)
        readonly TRANSACTIONAL_SMTP_HOST: string,
        readonly TRANSACTIONAL_SMTP_USERNAME: string,
        readonly TRANSACTIONAL_SMTP_PASSWORD: string,
        readonly TRANSACTIONAL_SMTP_PORT: number,
        readonly TRANSACTIONAL_SMTP_HEADERS?: Record<string, string>,
        readonly TRANSACTIONAL_WHITELIST?: string[] // E-mails we are allowed to send transactional e-mails from

        // Postmark
        // To catch email bounces
        readonly POSTMARK_SERVER_TOKEN?: string,
        
        // AWS
        // Mapped to process.env for dependencies
        readonly AWS_ACCESS_KEY_ID: string,
        readonly AWS_SECRET_ACCESS_KEY: string,
        readonly AWS_REGION: "eu-west-1" | string, // TODO: add others
 
        // DO spaces
        readonly SPACES_ENDPOINT: string,
        readonly SPACES_BUCKET: string,
        readonly SPACES_KEY: string,
        readonly SPACES_SECRET: string,
        readonly SPACES_PREFIX?: string,
 
         // Mollie
        readonly MOLLIE_CLIENT_ID: string,
        readonly MOLLIE_SECRET: string,
 
         // For Stamhoofd billing
        readonly MOLLIE_API_KEY: string,
        readonly MOLLIE_ORGANIZATION_TOKEN: string,
 
         // App versions
        readonly LATEST_IOS_VERSION: number,
        readonly LATEST_ANDROID_VERSION: number
 
         // Nolt
        readonly NOLT_SSO_SECRET_KEY?: string

        // Stripe
        readonly STRIPE_ACCOUNT_ID: string
        readonly STRIPE_SECRET_KEY: string
        readonly STRIPE_CONNECT_ENDPOINT_SECRET: string
        readonly STRIPE_ENDPOINT_SECRET: string
        readonly STRIPE_CONNECT_METHOD: 'express' | 'standard'

        // Communication with other internal services
        readonly INTERNAL_SECRET_KEY: string

        // File signing
        readonly FILE_SIGNING_PUBLIC_KEY: jose.JWK
        readonly FILE_SIGNING_PRIVATE_KEY: jose.JWK
        readonly FILE_SIGNING_ALG?: string

        readonly CRONS_DISABLED?: boolean

        readonly WHITELISTED_EMAIL_DESTINATIONS?: string[] // E-mails we are allowed to send e-mails to in case of staging or development environment
        readonly CACHE_PATH: string

        readonly MEMBER_NUMBER_ALGORITHM?: MemberNumberAlgorithm
        readonly MEMBER_NUMBER_ALGORITHM_LENGTH?: number
    }

    type BackendEnvironment = SharedEnvironment & BackendSpecificEnvironment

    /**
     * Environment only available in the frontend apps
     */
    type FrontendSpecificEnvironment = {
        readonly VERSION: string
        readonly NOLT_URL?: string
        readonly MOLLIE_CLIENT_ID: string
        readonly APP_UPDATE_SERVER_URL?: string

        // Switching envs
        readonly APP_UPDATE_PRODUCTION_SERVER_URL?: string
        readonly APP_UPDATE_STAGING_SERVER_URL?: string
        readonly APP_UPDATE_DEVELOPMENT_SERVER_URL?: string

        readonly CHANGELOG_URL?: Localized<`https://${string}`>

        readonly ILLUSTRATIONS_NAMESPACE?: string // A subfolder of 'illustrations' will be used for illustrations (if the illustration exists)
        readonly ILLUSTRATIONS_COLORS?: Record<string, `#${string}`>
        readonly PLAUSIBLE_DOMAIN?: string

        /**
         * Redirect users that are not logged in to this domain (maintaining the same path)
         */
        readonly REDIRECT_LOGIN_DOMAIN?: string

    }

    /** 
     * The environment that is available everywhere: frontend, backend and shared
     */ 
    type RedirecterEnvironment = {
        /**
         * We'll map the value of NODE_ENV to the corresponsing value. But staging value isn't valid for NODE_ENV, hence our own variable
         */
        readonly environment: "production" | "development" | "staging" | "test"
        readonly PORT: number
        readonly domains: string[]
    }

    /** 
     * The environment that is available everywhere: frontend, backend and shared
     */ 
    type RendererEnvironment = {
        /**
         * We'll map the value of NODE_ENV to the corresponsing value. But staging value isn't valid for NODE_ENV, hence our own variable
         */
        readonly environment: "production" | "development" | "staging" | "test"
        readonly PORT: number
        readonly CACHE_PATH: string

        // Communication with other internal services
        readonly INTERNAL_SECRET_KEY: string
        readonly translationNamespace: string
        readonly platformName: string
    }

     /** 
     * The environment that is available everywhere: frontend, backend and shared
     */ 
     type BackupEnvironment = {
        /**
         * We'll map the value of NODE_ENV to the corresponsing value. But staging value isn't valid for NODE_ENV, hence our own variable
         */
        readonly environment: "production" | "development" | "staging" | "test"
        readonly PORT: number

        // Database to backup
        readonly DB_HOST: string,
        readonly DB_DATABASE: string
        readonly DB_USER: string,
        readonly DB_PASS: string,
        readonly CRONS_DISABLED?: boolean

        readonly keyFingerprint: string
        readonly objectStoragePath: string
        readonly localBackupFolder: string

        readonly SPACES_ENDPOINT: string,
        readonly SPACES_BUCKET: string,
        readonly SPACES_KEY: string,
        readonly SPACES_SECRET: string
        readonly AWS_REGION: "eu-west-1" | string, // TODO: add others

        readonly IS_REPLICA?: boolean, // Whether this is a replica server and health checks should also check replica health

        readonly HEALTH_ACCESS_KEY?: string // Optional for a little bit of extra security (the health endpoint does not expose any sensitive information)
    }
    
    type FrontendEnvironment = SharedEnvironment & FrontendSpecificEnvironment

    const $t: (key: string, replace?: Record<string, string>) => string
    const $getCountry: () => Country
    const $getLanguage: () => string
}
