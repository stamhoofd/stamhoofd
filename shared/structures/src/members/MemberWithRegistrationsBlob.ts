import { ArrayDecoder, AutoEncoder, field } from '@simonbackx/simple-encoding';

import { Organization } from '../Organization';
import { User } from '../User';
import { memberWithRegistrationsBlobInMemoryFilterCompilers } from '../filters/filterDefinitions';
import { compileToInMemoryFilter } from '../filters/new/InMemoryFilter';
import { StamhoofdFilter } from '../filters/new/StamhoofdFilter';
import { Member } from './Member';
import { Registration } from './Registration';
import { Filterable } from './records/RecordCategory';
import { MemberResponsibilityRecord } from './MemberResponsibilityRecord';
import { MemberPlatformMembership } from './MemberPlatformMembership';


export class MemberWithRegistrationsBlob extends Member implements Filterable {
    @field({ decoder: new ArrayDecoder(Registration) })
    registrations: Registration[]

    @field({ decoder: new ArrayDecoder(User), version: 32 })
    users: User[]

    @field({ decoder: new ArrayDecoder(MemberResponsibilityRecord), version: 263 })
    responsibilities: MemberResponsibilityRecord[] = []

    @field({ decoder: new ArrayDecoder(MemberPlatformMembership), version: 270 })
    platformMemberships: MemberPlatformMembership[] = []

    doesMatchFilter(filter: StamhoofdFilter)  {
        try {
            const compiledFilter = compileToInMemoryFilter(filter, memberWithRegistrationsBlobInMemoryFilterCompilers)
            return compiledFilter(this)
        } catch (e) {
            console.error('Error while compiling filter', e, filter);
        }
        return false;
    }

    outstandingBalanceFor(organizationId: string) {
        return this.registrations.filter(r => r.organizationId == organizationId).reduce((sum, r) => sum + (r.price - r.pricePaid), 0)
    }
}

export class MembersBlob extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(MemberWithRegistrationsBlob) })
    members: MemberWithRegistrationsBlob[] = []

    @field({ decoder: new ArrayDecoder(Organization) })
    organizations: Organization[] = []
}
