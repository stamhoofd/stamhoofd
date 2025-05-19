import { field } from '@simonbackx/simple-encoding';

import { MemberWithRegistrationsBlob } from './MemberWithRegistrationsBlob.js';
import { Registration } from './Registration.js';

export class RegistrationWithMemberBlob extends Registration {
    @field({ decoder: MemberWithRegistrationsBlob })
    member: MemberWithRegistrationsBlob;
}
