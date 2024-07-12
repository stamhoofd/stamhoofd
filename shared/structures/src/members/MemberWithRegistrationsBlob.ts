import { ArrayDecoder, AutoEncoder, field } from '@simonbackx/simple-encoding';

import { Organization } from '../Organization';
import { User } from '../User';
import { EmailRecipient } from '../email/Email';
import { memberWithRegistrationsBlobInMemoryFilterCompilers } from '../filters/filterDefinitions';
import { compileToInMemoryFilter } from '../filters/new/InMemoryFilter';
import { StamhoofdFilter } from '../filters/new/StamhoofdFilter';
import { Member } from './Member';
import { MemberPlatformMembership } from './MemberPlatformMembership';
import { MemberResponsibilityRecord } from './MemberResponsibilityRecord';
import { Registration } from './Registration';
import { Filterable } from './records/RecordCategory';
import { Replacement } from '../endpoints/EmailRequest';
import { Formatter } from '@stamhoofd/utility';


export class MemberWithRegistrationsBlob extends Member implements Filterable {
    @field({ decoder: new ArrayDecoder(Registration) })
    registrations: Registration[] = []

    @field({ decoder: new ArrayDecoder(User), version: 32 })
    users: User[] = []

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

    getEmailRecipients(subtypes: ('member'|'parents')[]|null = null): EmailRecipient[] {
        const recipients: EmailRecipient[] = []

        const shared: Replacement[] = []
        shared.push(Replacement.create({
            token: "firstNameMember",
            value: this.firstName
        }))

        shared.push(Replacement.create({
            token: "lastNameMember",
            value: this.details.lastName ?? ''
        }))

        shared.push(Replacement.create({
            token: "outstandingBalance",
            value: Formatter.price(this.outstandingBalance)
        }))

        if (this.details.email && (subtypes === null || subtypes.includes('member'))) {
            recipients.push(
                EmailRecipient.create({
                    firstName: this.details.firstName,
                    lastName: this.details.lastName,
                    email: this.details.email,
                    replacements: [
                        Replacement.create({
                            token: "firstName",
                            value: this.details.firstName
                        }),
                        Replacement.create({
                            token: "lastName",
                            value: this.details.lastName
                        }),
                        Replacement.create({
                            token: "email",
                            value: this.details.email
                        }),
                        ...shared
                    ]
                })
            )
        }

        if (subtypes === null || subtypes.includes('parents')) {
            for (const parent of this.details.parents) {
                if (parent.email) {
                    recipients.push(
                        EmailRecipient.create({
                            firstName: parent.firstName,
                            lastName: parent.lastName,
                            email: parent.email,
                            replacements: [
                                Replacement.create({
                                    token: "firstName",
                                    value: parent.firstName
                                }),
                                Replacement.create({
                                    token: "lastName",
                                    value: parent.lastName
                                }),
                                Replacement.create({
                                    token: "email",
                                    value: parent.email.toLowerCase()
                                }),
                                ...shared
                            ]
                        })
                    )
                }
            }
        }

        return recipients
    }
}

export class MembersBlob extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(MemberWithRegistrationsBlob) })
    members: MemberWithRegistrationsBlob[] = []

    @field({ decoder: new ArrayDecoder(Organization) })
    organizations: Organization[] = []
}
