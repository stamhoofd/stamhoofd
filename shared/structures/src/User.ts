import { AutoEncoder, BooleanDecoder, DateDecoder, EmailDecoder, EnumDecoder, field, MapDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';

import { Permissions } from './Permissions.js';
import { UserPermissions } from './UserPermissions.js';

// Note: also update LoginMethod
export enum LoginProviderType {
    SSO = 'SSO',
    Google = 'Google',
}

/**
 * Defines the applicable rate limits of the user (only used for API's).
 * Can only get changed by a platform admin
 */
export enum ApiUserRateLimits {
    Normal = 'Normal',
    Medium = 'Medium',
    High = 'High',
}

export class UserMeta extends AutoEncoder {
    /**
     * When signed in with SSO, this is the id of that user in the SSO system
     */
    @field({ decoder: new MapDecoder(new EnumDecoder(LoginProviderType), StringDecoder) })
    loginProviderIds: Map<LoginProviderType, string> = new Map();

    @field({ decoder: new EnumDecoder(ApiUserRateLimits), nullable: true, version: 369 })
    rateLimits: ApiUserRateLimits | null = null;
}

export class User extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder, nullable: true, version: 245 })
    organizationId: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 281 })
    memberId: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 14 })
    firstName: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 14 })
    lastName: string | null = null;

    @field({ decoder: EmailDecoder })
    email: string;

    @field({ decoder: Permissions, nullable: true, version: 2, upgrade: () => null })
    @field({
        decoder: UserPermissions,
        nullable: true,
        version: 248,
        upgrade: function (this: User, oldValue: Permissions | null): UserPermissions | null {
            if (!oldValue || !this.organizationId) {
                return null;
            }
            const m = new Map<string, Permissions>();
            m.set(this.organizationId, oldValue);

            return UserPermissions.create({
                globalPermissions: null,
                organizationPermissions: m,
            });
        },
    })
    permissions: UserPermissions | null = null;

    /**
     * Readonly
     */
    @field({ decoder: UserMeta, nullable: true, version: 191 })
    meta: UserMeta | null = null;

    @field({ decoder: BooleanDecoder, version: 81 })
    verified = false;

    /**
     * Readonly
     */
    @field({ decoder: BooleanDecoder, version: 162 })
    hasAccount = false;

    /**
     * Readonly
     */
    @field({ decoder: BooleanDecoder, version: 360 })
    hasPassword = false;

    get name() {
        if (!this.lastName) {
            if (!this.firstName) {
                return '';
            }
            return this.firstName;
        }
        return this.firstName + ' ' + this.lastName;
    }
}

export class NewUser extends User {
    /**
     * Will be empty in responses for now
     */
    @field({ decoder: StringDecoder, version: 162 })
    password = '';
}

export class ApiUser extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder, nullable: true, version: 245 })
    organizationId: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 14 })
    name: string | null = null;

    @field({ decoder: Permissions, nullable: true, version: 2, upgrade: () => null })
    @field({
        decoder: UserPermissions,
        nullable: true,
        version: 248,
        upgrade: function (this: User, oldValue: Permissions | null): UserPermissions | null {
            if (!oldValue || !this.organizationId) {
                return null;
            }
            const m = new Map<string, Permissions>();
            m.set(this.organizationId, oldValue);

            return UserPermissions.create({
                globalPermissions: null,
                organizationPermissions: m,
            });
        },
    })
    permissions: UserPermissions | null = null;

    /**
     * Readonly
     */
    @field({ decoder: UserMeta, nullable: true, version: 369 })
    meta: UserMeta | null = null;

    @field({ decoder: DateDecoder })
    createdAt = new Date();

    @field({ decoder: DateDecoder, nullable: true })
    expiresAt: Date | null = null;
}

export class ApiUserWithToken extends ApiUser {
    @field({ decoder: StringDecoder })
    token: string;
}
