import type { PlatformMemberReference, RegistrationReference } from './RegistrationWithPlatformMemberTypes.js';

export class RegistrationWithPlatformMember<R extends RegistrationReference = RegistrationReference, M extends PlatformMemberReference = PlatformMemberReference> {
    registration: R;
    member: M;

    constructor(options: { registration: R; member: M }) {
        this.registration = options.registration;
        this.member = options.member;
    }

    clone(): RegistrationWithPlatformMember<R, M> {
        return new RegistrationWithPlatformMember<R, M>({
            registration: this.registration.clone(),
            member: this.member, // no need to clone because it is a reference
        });
    }

    // Convenience helpers
    get group(): R['group'] {
        return this.registration.group;
    }
}
