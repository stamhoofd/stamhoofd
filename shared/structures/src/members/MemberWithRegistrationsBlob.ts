import { ArrayDecoder, AutoEncoder, field } from '@simonbackx/simple-encoding';

import { Formatter } from '@stamhoofd/utility';
import { Organization } from '../Organization';
import { User } from '../User';
import { EmailRecipient } from '../email/Email';
import { Replacement } from '../endpoints/EmailRequest';
import { memberWithRegistrationsBlobInMemoryFilterCompilers } from '../filters/filterDefinitions';
import { compileToInMemoryFilter } from '../filters/new/InMemoryFilter';
import { StamhoofdFilter } from '../filters/new/StamhoofdFilter';
import { Member } from './Member';
import { MemberPlatformMembership } from './MemberPlatformMembership';
import { MemberResponsibilityRecord } from './MemberResponsibilityRecord';
import { Registration } from './Registration';
import { Filterable } from './records/RecordCategory';


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

    hasAccount(email: string) {
        return !!this.users.find(u => u.hasAccount && u.email === email)
    }

    getEmailRecipients(subtypes: ('member'|'parents'|'unverified')[]|null = null): EmailRecipient[] {
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

        const createLoginDetailsReplacement = (email: string) => {
            const formattedEmail = Formatter.escapeHtml(email);

            return Replacement.create({
                token: "loginDetails",
                value: "",
                html: this.hasAccount(email) ? `<p class="description"><em>Je kan op het ledenportaal inloggen met <strong>${formattedEmail}</strong></em></p>` : `<p class="description"><em>Je kan op het ledenportaal een nieuw account aanmaken met het e-mailadres <strong>${formattedEmail}</strong>, dan krijg je automatisch toegang tot alle bestaande gegevens.</em></p>`
            })
        };

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
                        createLoginDetailsReplacement(this.details.email),
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
                                createLoginDetailsReplacement(parent.email),
                                ...shared
                            ]
                        })
                    )
                }
            }
        }

        if(subtypes && subtypes.includes('unverified')) {
            for(const unverifiedEmail of this.details.unverifiedEmails) {
                recipients.push(
                    EmailRecipient.create({
                        email: unverifiedEmail,
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
                                value: unverifiedEmail.toLowerCase()
                            }),
                            createLoginDetailsReplacement(unverifiedEmail),
                            ...shared
                        ]
                    })
                )
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
