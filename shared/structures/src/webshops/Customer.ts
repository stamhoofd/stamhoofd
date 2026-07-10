import { AutoEncoder, DateDecoder, EnumDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { Address } from '../addresses/Address.js';
import { Gender } from '../members/Gender.js';
import { PaymentCustomer } from '../PaymentCustomer.js';

export class Customer extends AutoEncoder {
    @field({ decoder: StringDecoder })
    firstName = '';

    @field({ decoder: StringDecoder })
    lastName = '';

    @field({ decoder: StringDecoder })
    email = '';

    @field({ decoder: StringDecoder })
    phone = '';

    @field({ decoder: DateDecoder, nullable: true, ...NextVersion })
    birthDay: Date | null = null;

    @field({ decoder: Address, nullable: true, ...NextVersion })
    address: Address | null = null;

    @field({ decoder: new EnumDecoder(Gender), defaultValue: () => Gender.Other, isDefaultValue: v => v === Gender.Other, ...NextVersion })
    gender: Gender = Gender.Other;

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
