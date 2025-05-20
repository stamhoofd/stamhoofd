import { type PlatformMember } from '../PlatformMember.js';
import { type Registration } from '../Registration.js';

export class RegistrationWithPlatformMember {
    registration: Registration;
    member: PlatformMember;

    constructor(options: { registration: Registration; member: PlatformMember }) {
        this.registration = options.registration;
        this.member = options.member;
    }

    clone() {
        return new RegistrationWithPlatformMember({
            registration: this.registration.clone(),
            member: this.member, // no need to clone because it is a reference
        });
    }

    // Convenience helpers
    get group() {
        return this.registration.group;
    }
}
