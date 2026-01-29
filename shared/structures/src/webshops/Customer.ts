import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';
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
