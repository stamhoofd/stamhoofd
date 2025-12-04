import { Factory } from '@simonbackx/simple-database';

import { BundleDiscount, GroupPrice } from '@stamhoofd/structures';
import { Group } from '../models/Group.js';
import { Member } from '../models/Member.js';
import { Registration } from '../models/Registration.js';
import { Organization } from '../models/index.js';
import { GroupFactory } from './GroupFactory.js';

type Options = ({
    member: Member;
    group: Group;
    groupPrice?: GroupPrice;
} | {
    member: Member;
    organization: Organization;
}) & {
    deactivatedAt?: Date;
};

export class RegistrationFactory extends Factory<Options, Registration> {
    async create(): Promise<Registration> {
        const registration = new Registration();
        registration.memberId = this.options.member.id;

        const group = 'group' in this.options ? this.options.group : await new GroupFactory({ organization: this.options.organization }).create();

        registration.groupId = group.id;
        registration.periodId = group.periodId;
        registration.organizationId = group.organizationId;

        registration.registeredAt = new Date();
        registration.registeredAt.setMilliseconds(0);
        registration.groupPrice = 'groupPrice' in this.options && this.options.groupPrice ? this.options.groupPrice : group.settings.prices[0];

        registration.deactivatedAt = this.options.deactivatedAt || null;

        await registration.save();

        // Create a balance item

        return registration;
    }
}
