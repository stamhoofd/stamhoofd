import { ArrayDecoder, AutoEncoder, field } from '@simonbackx/simple-encoding';

import { Organization } from '../Organization.js';
import { RegistrationWithMemberBlob } from './RegistrationWithMemberBlob.js';

export class RegistrationsBlob extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(RegistrationWithMemberBlob) })
    registrations: RegistrationWithMemberBlob[] = [];

    @field({ decoder: new ArrayDecoder(Organization) })
    organizations: Organization[] = [];
}
