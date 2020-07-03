import { ArrayDecoder,AutoEncoder, field } from '@simonbackx/simple-encoding';

import { KeychainItem } from '../KeychainItem';
import { Organization } from '../Organization';
import { NewUser } from '../User';

export class CreateOrganiation extends AutoEncoder {
    @field({ decoder: Organization })
    organization: Organization

    /**
     * The first (administrator) user of this organization
     */
    @field({ decoder: NewUser })
    user: NewUser

    /**
     * When creating an organization, you will need to generate a public/private key pair for 
     * the organization. You'll need to do the same for the first user of this organization 
     * (and following users you add in the future). The user you created should get access to
     * the organization by creating a keychain item in the database that contains the 
     * encrypted private key of the organization, encrypted with the private key of the user.
     */
    @field({ decoder: new ArrayDecoder(KeychainItem) })
    keychainItems: KeychainItem[]
}