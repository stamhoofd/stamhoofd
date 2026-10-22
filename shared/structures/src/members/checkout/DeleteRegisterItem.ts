import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import type { RegisterContext } from './RegisterCheckout.js';
import { RegistrationWithPlatformMember } from './RegistrationWithPlatformMember.js';

export class IDDeleteRegisterItem extends AutoEncoder {
    @field({ decoder: StringDecoder })
    registrationId: string;

    hydrate(context: RegisterContext): DeleteRegisterItem {
        for (const member of context.members) {
            const registration = member.patchedMember.registrations.find(r => r.id === this.registrationId);
            if (!registration) {
                continue;
            }

            return new DeleteRegisterItem({
                registration: new RegistrationWithPlatformMember({ registration, member }),
            });
        }

        throw new SimpleError({
            code: 'not_found',
            message: 'Registration not found',
            human: $t(`%qn`),
            field: 'deleteRegistrations',
        });
    }
}

export class DeleteRegisterItem {
    registration: RegistrationWithPlatformMember;

    constructor(options: { registration: RegistrationWithPlatformMember }) {
        this.registration = options.registration;
    }

    get id() {
        return this.registration.registration.id;
    }

    clone() {
        return new DeleteRegisterItem({
            registration: this.registration.clone(),
        });
    }

    convert(): IDDeleteRegisterItem {
        return IDDeleteRegisterItem.create({
            registrationId: this.id,
        });
    }
}
