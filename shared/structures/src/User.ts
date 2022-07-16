import { AutoEncoder, BooleanDecoder, EmailDecoder,field, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from "uuid";

import { Permissions } from './Permissions';

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