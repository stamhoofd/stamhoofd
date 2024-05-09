import { Factory } from "@simonbackx/simple-database";

import { Group } from "../models/Group";
import { Member } from '../models/Member';
import { Registration } from '../models/Registration';

class Options {
    member: Member;
    group: Group;
    waitingList?: boolean
}

export class RegistrationFactory extends Factory<Options, Registration> {
    async create(): Promise<Registration> {
        const registration = new Registration()
        registration.memberId = this.options.member.id
        registration.groupId = this.options.group.id
        registration.organizationId = this.options.group.organizationId
        registration.cycle = this.options.group.cycle

        if (this.options.waitingList !== true) {
            registration.registeredAt = new Date()
            registration.registeredAt.setMilliseconds(0)
        } else {
            registration.waitingList = true
        }
        
        await registration.save()
        return registration;
    }
}
