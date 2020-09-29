import { Factory } from "@simonbackx/simple-database";
import { PaymentMethod, PaymentStatus } from "@stamhoofd/structures";

import { Group } from "../models/Group";
import { Member } from '../models/Member';
import { Payment } from '../models/Payment';
import { Registration, RegistrationWithPayment } from '../models/Registration';

class Options {
    member: Member;
    group: Group;
    waitingList?: boolean
}

export class RegistrationFactory extends Factory<Options, RegistrationWithPayment> {
    async create(): Promise<RegistrationWithPayment> {
        let payment: Payment | null = null
        if (this.options.waitingList !== true) {
            payment = new Payment()
            payment.method = PaymentMethod.Transfer
            payment.status = PaymentStatus.Succeeded
            payment.paidAt = new Date()
            payment.paidAt.setMilliseconds(0)
            payment.price = 400
            payment.transferDescription = Payment.generateOGM()
            await payment.save()
        }
        
        const registration = new Registration().setOptionalRelation(Registration.payment, payment)
        registration.memberId = this.options.member.id
        registration.groupId = this.options.group.id
        registration.cycle = this.options.group.cycle

        if (payment) {
            registration.registeredAt = new Date()
            registration.registeredAt.setMilliseconds(0)
        } else {
            registration.waitingList = true
        }
        
        await registration.save()
        return registration;
    }
}
