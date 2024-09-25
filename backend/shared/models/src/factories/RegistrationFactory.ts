import { Factory } from '@simonbackx/simple-database';

import { GroupPrice } from '@stamhoofd/structures';
import { Group } from '../models/Group';
import { Member } from '../models/Member';
import { Registration } from '../models/Registration';

class Options {
    member: Member;
    group: Group;
    groupPrice: GroupPrice;
    price?: number;
}

export class RegistrationFactory extends Factory<Options, Registration> {
    async create(): Promise<Registration> {
        const registration = new Registration();
        registration.memberId = this.options.member.id;
        registration.groupId = this.options.group.id;
        registration.periodId = this.options.group.periodId;
        registration.organizationId = this.options.group.organizationId;
        registration.registeredAt = new Date();
        registration.registeredAt.setMilliseconds(0);
        registration.groupPrice = this.options.groupPrice;
        registration.price = this.options.price === undefined ? registration.groupPrice.price.price : this.options.price;

        await registration.save();
        return registration;
    }
}
