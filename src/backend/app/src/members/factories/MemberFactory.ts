import { Organization } from '@stamhoofd-backend/app/src/organizations/models/Organization';
import { Factory } from '@stamhoofd-backend/database';

import { Member } from '../models/Member';

class Options {
    organization: Organization
}

export class MemberFactory extends Factory<Options, Member> {
    async create(): Promise<Member> {
        const member = new Member().setRelation(Member.organization, this.options.organization)
        member.encrypted = "This is encrypted data"

        await member.save()
        return member
    }
}