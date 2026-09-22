import { AutoEncoder, DateDecoder, EnumDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { Address } from '../addresses/Address.js';
import { Gender } from '../members/Gender.js';
import { PaymentCustomer } from '../PaymentCustomer.js';
import { CustomerFieldRequirement } from './CustomerFieldRequirement.js';
import type { CustomerSettings } from './CustomerSettings.js';

export class Customer extends AutoEncoder {
    @field({ decoder: StringDecoder })
    firstName = '';

    @field({ decoder: StringDecoder })
    lastName = '';

    @field({ decoder: StringDecoder })
    email = '';

    @field({ decoder: StringDecoder })
    phone = '';

    @field({ decoder: DateDecoder, nullable: true, version: 403 })
    birthDay: Date | null = null;

    @field({ decoder: Address, nullable: true, version: 403 })
    address: Address | null = null;

    @field({ decoder: new EnumDecoder(Gender), defaultValue: () => Gender.Other, isDefaultValue: v => v === Gender.Other, version: 403 })
    gender: Gender = Gender.Other;

    /**
     * Split off so the inputs can validate the name on its own, without requiring the other fields yet.
     */
    validateName(requirement: CustomerFieldRequirement) {
        if (requirement === CustomerFieldRequirement.Disabled) {
            this.firstName = '';
            this.lastName = '';
            return;
        }

        // Unlike the other fields, a name is also required for admins
        const required = requirement === CustomerFieldRequirement.Required;

        if (this.firstName.length < 2 && (required || this.firstName.length > 0)) {
            throw new SimpleError({
                code: 'invalid_first_name',
                message: 'Invalid first name',
                human: $t(`%sn`),
                field: 'customer.firstName',
            });
        }

        if (this.lastName.length < 2 && (required || this.lastName.length > 0)) {
            throw new SimpleError({
                code: 'invalid_last_name',
                message: 'Invalid last name',
                human: $t(`%so`),
                field: 'customer.lastName',
            });
        }
    }

    /**
     * Throws with `customer.*` fields.
     * Required = must be present and well-formed, Optional = only validate the format when a value is given, Disabled = clear the value.
     * Admins may leave required fields empty, except for the email format.
     */
    validate(settings: CustomerSettings, { asAdmin = false }: { asAdmin?: boolean } = {}) {
        this.validateName(settings.name);

        if (settings.phone === CustomerFieldRequirement.Disabled) {
            this.phone = '';
        } else if (this.phone.length < 6 && !asAdmin && (settings.phone === CustomerFieldRequirement.Required || this.phone.length > 0)) {
            throw new SimpleError({
                code: 'invalid_phone',
                message: 'Invalid phone',
                human: $t('%1Be'),
                field: 'customer.phone',
            });
        }

        if (settings.birthDay === CustomerFieldRequirement.Disabled) {
            this.birthDay = null;
        } else if (!this.birthDay && !asAdmin && settings.birthDay === CustomerFieldRequirement.Required) {
            throw new SimpleError({
                code: 'invalid_birth_day',
                message: 'Invalid birth day',
                human: $t(`%yq`),
                field: 'customer.birthDay',
            });
        }

        if (settings.address === CustomerFieldRequirement.Disabled) {
            this.address = null;
        } else if (!this.address && !asAdmin && settings.address === CustomerFieldRequirement.Required) {
            throw new SimpleError({
                code: 'invalid_address',
                message: 'Invalid address',
                human: $t(`%ZdB`),
                field: 'customer.address',
            });
        }

        if (settings.gender === CustomerFieldRequirement.Disabled) {
            this.gender = Gender.Other;
        }

        if (settings.email === CustomerFieldRequirement.Disabled) {
            this.email = '';
        } else if (settings.email === CustomerFieldRequirement.Required || this.email.length > 0) {
            const regex = /^[\w.!#$%&'*+/=?^`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i;

            if (!regex.test(this.email)) {
                throw new SimpleError({
                    code: 'invalid_email',
                    message: 'Invalid email',
                    human: $t('%sR'),
                    field: 'customer.email',
                });
            }
        }
    }

    get name() {
        if (this.lastName === '') {
            return this.firstName;
        }
        if (this.firstName === '') {
            return this.lastName;
        }
        return this.firstName + ' ' + this.lastName;
    }

    toPaymentCustomer(): PaymentCustomer {
        return PaymentCustomer.create({
            firstName: this.firstName,
            lastName: this.lastName,
            email: this.email,
            phone: this.phone,
        });
    }
}
