import { field } from '@simonbackx/simple-encoding';

import { TinyMember } from './Member.js';
import { Registration } from './Registration.js';

export class RegistrationWithTinyMember extends Registration {
    @field({ decoder: TinyMember })
    member: TinyMember;

    static from(registration: Registration, member: TinyMember) {
        return RegistrationWithTinyMember.create({
            ...registration,
            member,
        });
    }
}
