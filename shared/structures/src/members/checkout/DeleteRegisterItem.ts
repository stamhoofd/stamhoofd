import { AutoEncoder, field, IntegerDecoder, StringDecoder } from '@common/encoding';
import { SimpleError } from '@common/errors';
import type { RegisterContext } from './RegisterCheckout.js';
import { RegistrationWithPlatformMember } from './RegistrationWithPlatformMember.js';

export class IDDeleteRegisterItem extends AutoEncoder {
    @field({ decoder: StringDecoder })
    registrationId: string;

    /**
     * Per ten thousand of the registration price
     */
    @field({ decoder: IntegerDecoder, version: 423 })
    cancellationFeePercentage = 0;

    hydrate(context: RegisterContext): DeleteRegisterItem {
        for (const member of context.members) {
            const registration = member.patchedMember.registrations.find(r => r.id === this.registrationId);
            if (!registration) {
                continue;
            }

            return new DeleteRegisterItem({
                registration: new RegistrationWithPlatformMember({ registration, member }),
                cancellationFeePercentage: this.cancellationFeePercentage,
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

    /**
     * Per ten thousand of the registration price
     */
    cancellationFeePercentage: number;

    constructor(options: { registration: RegistrationWithPlatformMember; cancellationFeePercentage: number }) {
        this.registration = options.registration;
        this.cancellationFeePercentage = options.cancellationFeePercentage;
    }

    /**
     * Charges 100% if something was already paid, so the paid amount is not refunded by default
     */
    static defaultFor(registration: RegistrationWithPlatformMember) {
        const paid = registration.registration.balances.reduce((total, balance) => total + balance.amountPaid + balance.amountPending, 0);
        return new DeleteRegisterItem({
            registration,
            cancellationFeePercentage: paid > 0 ? 100_00 : 0,
        });
    }

    get id() {
        return this.registration.registration.id;
    }

    get cancellationFee() {
        return Math.round(this.registration.registration.calculatedPrice * this.cancellationFeePercentage / 10000);
    }

    clone() {
        return new DeleteRegisterItem({
            registration: this.registration.clone(),
            cancellationFeePercentage: this.cancellationFeePercentage,
        });
    }

    convert(): IDDeleteRegisterItem {
        return IDDeleteRegisterItem.create({
            registrationId: this.id,
            cancellationFeePercentage: this.cancellationFeePercentage,
        });
    }

    validate() {
        if (this.cancellationFeePercentage > 100_00 || this.cancellationFeePercentage < 0) {
            throw new SimpleError({
                code: 'invalid_field',
                field: 'cancellationFeePercentage',
                message: 'Invalid cancellation fee percentage',
            });
        }
    }
}
