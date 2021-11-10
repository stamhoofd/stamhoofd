
export {};

declare enum Country {
    Belgium = "BE",
    Netherlands = "NL",
    Luxembourg = "LU",
    France = "FR",
    Germany = "DE"
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
    type LocalizedDomain = {
        readonly [k in Country]?: string;
    } & {
        /// default is reserved, so we need to use something else (an empty string)
        readonly "": string;
    };

    type StamhoofdDomains = {
        dashboard: string,
        registration: LocalizedDomain,  // requires wildcard prefix DNS
        webshop: string,                // requires wildcard prefix DNS
        api: string,                    // requires wildcard prefix DNS
        demoApi: string,                // requires wildcard prefix DNS
        admin: string,
        adminApi: string
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

        // E-mail
        readonly SMTP_HOST: string,
        readonly SMTP_USERNAME: string,
        readonly SMTP_PASSWORD: string,
        readonly SMTP_PORT: number,
        
        // AWS
        // Mapped to process.env for dependencies
        readonly AWS_ACCESS_KEY_ID: string,
        readonly AWS_SECRET_ACCESS_KEY: string,
        readonly AWS_REGION: "eu-west-1" | string, // todo: add others
 
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
        readonly NOLT_SSO_SECRET_KEY: string

        readonly FACEBOOK_ACCESS_TOKEN?: string
        readonly FACEBOOK_PIXEL_ID?: string
        readonly FACEBOOK_TEST_EVENT_CODE?: string
    }

    type BackendEnvironment = SharedEnvironment & BackendSpecificEnvironment

    /**
     * Environment only available in the frontend apps
     */
    type FrontendSpecificEnvironment = {
        readonly NOLT_URL: string
        readonly MOLLIE_CLIENT_ID: string
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
    
    type FrontendEnvironment = SharedEnvironment & FrontendSpecificEnvironment
}