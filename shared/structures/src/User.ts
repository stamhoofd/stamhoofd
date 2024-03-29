import { AnyDecoder, ArrayDecoder, AutoEncoder, BooleanDecoder, DateDecoder, EmailDecoder,EnumDecoder,field, MapDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from "uuid";

import { Permissions } from './Permissions';

export enum LoginProviderType {
    SSO = "SSO",
}

export class UserMeta extends AutoEncoder {
    /**
     * When signed in with SSO, this is the id of that user in the SSO system
     */
    @field({ decoder: new MapDecoder(new EnumDecoder(LoginProviderType), StringDecoder) })
    loginProviderIds: Map<LoginProviderType, string> = new Map();
}

export class User extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder, nullable: true, version: 14 })
    firstName: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 14 })
    lastName: string | null = null;

    @field({ decoder: EmailDecoder })
    email: string;

    @field({ decoder: Permissions, nullable: true, version: 2, upgrade: () => null })
    permissions: Permissions | null = null

    /**
     * Readonly
     */
    @field({ decoder: UserMeta, nullable: true, version: 191 })
    meta: UserMeta | null = null

    @field({ decoder: BooleanDecoder, version: 81 })
    verified = false

    /**
     * Readonly
     */
    @field({ decoder: BooleanDecoder, version: 162 })
    hasAccount = false
}

export class NewUser extends User {
    /**
     * Will be empty in responses for now
     */
    @field({ decoder: StringDecoder, version: 162 })
    password = '';
}

export class MyUser extends NewUser {
    /**
     * @deprecated
     */
    @field({ decoder: new ArrayDecoder(AnyDecoder), optional: true })
    incomingInvites: never[] = []
}

export class ApiUser extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder, nullable: true, version: 14 })
    name: string | null = null;

    @field({ decoder: Permissions, nullable: true, version: 2, upgrade: () => null })
    permissions: Permissions | null = null

    @field({ decoder: DateDecoder })
    createdAt = new Date();

    @field({ decoder: DateDecoder, nullable: true })
    expiresAt: Date|null = null;
}

export class ApiUserWithToken extends ApiUser {
    @field({ decoder: StringDecoder })
    token: string;
}
