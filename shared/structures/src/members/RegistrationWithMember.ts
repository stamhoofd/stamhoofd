import { field } from '@simonbackx/simple-encoding';

import { TinyMember } from './Member.js';
import { Registration } from './Registration.js';

export class RegistrationWithMember extends Registration {
    @field({ decoder: TinyMember })
    member: TinyMember;

    static from(registration: Registration, member: TinyMember) {
        return RegistrationWithMember.create({
            ...registration,
            member,
        });
    }
}
