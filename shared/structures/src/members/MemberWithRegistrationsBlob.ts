import { ArrayDecoder, AutoEncoder, DateDecoder, field } from '@simonbackx/simple-encoding';

import { Formatter } from '@stamhoofd/utility';
import { Organization } from '../Organization';
import { User } from '../User';
import { EmailRecipient } from '../email/Email';
import { Replacement } from '../endpoints/EmailRequest';
import { memberWithRegistrationsBlobInMemoryFilterCompilers } from '../filters/inMemoryFilterDefinitions';
import { compileToInMemoryFilter } from '../filters/InMemoryFilter';
import { StamhoofdFilter } from '../filters/StamhoofdFilter';
import { Member } from './Member';
import { MemberPlatformMembership } from './MemberPlatformMembership';
import { Registration } from './Registration';
import { Filterable } from './records/RecordCategory';
import { MemberResponsibilityRecord } from './MemberResponsibilityRecord';

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

            let suffix = '';

            if (this.details.securityCode) {
                suffix = ` De beveiligingscode voor ${Formatter.escapeHtml(this.firstName)} is <span class="style-inline-code">${Formatter.escapeHtml(Formatter.spaceString(this.details.securityCode, 4, '-'))}</span>.`
            }

            return Replacement.create({
                token: "loginDetails",
                value: "",
                html: this.hasAccount(email) ? `<p class="description"><em>Je kan op het ledenportaal inloggen met <strong>${formattedEmail}</strong>.${suffix}</em></p>` : `<p class="description"><em>Je kan op het ledenportaal een nieuw account aanmaken met het e-mailadres <strong>${formattedEmail}</strong>, dan krijg je automatisch toegang tot alle bestaande gegevens.${suffix}</em></p>`
            })
        };

        if (this.details.email && (subtypes === null || subtypes.includes('member'))) {
            recipients.push(
                EmailRecipient.create({
                    firstName: this.details.firstName,
                    lastName: this.details.lastName,
                    email: this.details.email,
                    replacements: [
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
                                createLoginDetailsReplacement(parent.email),
                                ...shared
                            ]
                        })
                    )
                }
            }
        }

        if (subtypes && subtypes.includes('unverified')) {
            for (const unverifiedEmail of this.details.unverifiedEmails) {
                recipients.push(
                    EmailRecipient.create({
                        email: unverifiedEmail,
                        replacements: [
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

    /**
     * Timestamp on which the backend constructed this blob
     * 
     * This is encoded, so it can be stored locally
     */
    @field({ decoder: DateDecoder, version: 329 })
    receivedAt = new Date()

    markReceivedFromBackend() {
        this.receivedAt = new Date()
    }

    get isStale() {
        return MembersBlob.lastPatchedMembersDate !== null && this.receivedAt < MembersBlob.lastPatchedMembersDate
    }

    static lastPatchedMembersDate: Date | null = null

    static markAllStale() {
        MembersBlob.lastPatchedMembersDate = new Date()
    }
}
