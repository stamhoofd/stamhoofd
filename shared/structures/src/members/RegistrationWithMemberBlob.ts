import { field } from '@common/encoding';

import { MemberWithRegistrationsBlob } from './MemberWithRegistrationsBlob.js';
import { Registration } from './Registration.js';

export class RegistrationWithMemberBlob extends Registration {
    @field({ decoder: MemberWithRegistrationsBlob })
    member: MemberWithRegistrationsBlob;
}
