import { ArrayDecoder, AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';

// Note: this should extend LoginProviderType
export enum LoginMethod {
    Password = 'Password',
    SSO = 'SSO',
    Google = 'Google',
}

/**
 * This config is public and should not contain any secrets. Use OpenIDClientConfiguration for private data
 */
export class LoginMethodConfig extends AutoEncoder {
    /**
     * Full name of this login method. e.g. 'Sign in with Google'
     */
    @field({ decoder: StringDecoder, nullable: true })
    loginButtonText: string | null = null;

    /**
     * Full name of this login method. e.g. 'Sign in with Google'
     */
    @field({ decoder: StringDecoder, nullable: true })
    fullName: string | null = null;

    /**
     * Full name of this login method. e.g. 'Google'
     */
    @field({ decoder: StringDecoder, nullable: true })
    shortName: string | null = null;

    /**
     * Limit this method to email addresses ending on these domains.
     * When this is empty, all domains are allowed.
    */
    @field({ decoder: new ArrayDecoder(StringDecoder) })
    allowlist: string[] = [];

    /**
     * Disallow this method for email addresses ending on these domains
     */
    @field({ decoder: new ArrayDecoder(StringDecoder) })
    blocklist: string[] = [];

    isEnabledForEmail(email: string) {
        // Validate that the user is allowed to use this method
        const emailDomain = email.split('@')[1].toLowerCase();
        if (!emailDomain) {
            return false;
        }

        for (const blocked of this.blocklist) {
            if (emailDomain === blocked.toLowerCase()) {
                return false;
            }
        }

        if (this.allowlist.length > 0) {
            for (const allowed of this.allowlist) {
                if (emailDomain === allowed.toLowerCase()) {
                    return true;
                }
            }

            return false;
        }

        return true;
    }
}
