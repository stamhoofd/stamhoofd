import { ArrayDecoder, AutoEncoder, DateDecoder, field } from '@simonbackx/simple-encoding';

import { Formatter } from '@stamhoofd/utility';
import { GenericBalance } from '../GenericBalance.js';
import { Organization } from '../Organization.js';
import { User } from '../User.js';
import { EmailRecipient } from '../email/Email.js';
import { Replacement } from '../endpoints/EmailRequest.js';
import { compileToInMemoryFilter } from '../filters/InMemoryFilter.js';
import { StamhoofdFilter } from '../filters/StamhoofdFilter.js';
import { memberWithRegistrationsBlobInMemoryFilterCompilers } from '../filters/inMemoryFilterDefinitions.js';
import { Member } from './Member.js';
import { MemberPlatformMembership } from './MemberPlatformMembership.js';
import { MemberResponsibilityRecord } from './MemberResponsibilityRecord.js';
import { Registration } from './Registration.js';
import { Filterable } from './records/RecordCategory.js';

export class MemberWithRegistrationsBlob extends Member implements Filterable {
    @field({ decoder: new ArrayDecoder(Registration) })
    registrations: Registration[] = [];

    @field({ decoder: new ArrayDecoder(User), version: 32 })
    users: User[] = [];

    @field({ decoder: new ArrayDecoder(MemberResponsibilityRecord), version: 263 })
    responsibilities: MemberResponsibilityRecord[] = [];

    @field({ decoder: new ArrayDecoder(MemberPlatformMembership), version: 270 })
    platformMemberships: MemberPlatformMembership[] = [];

    @field({ decoder: new ArrayDecoder(GenericBalance), version: 375 })
    balances: GenericBalance[] = [];

    doesMatchFilter(filter: StamhoofdFilter) {
        try {
            const compiledFilter = compileToInMemoryFilter(filter, memberWithRegistrationsBlobInMemoryFilterCompilers);
            return compiledFilter(this);
        }
        catch (e) {
            console.error('Error while compiling filter', e, filter);
        }
        return false;
    }

    hasAccount(email: string) {
        return !!this.users.find(u => u.hasAccount && u.email === email);
    }

    getEmailRecipients(subtypes: ('member' | 'parents' | 'unverified')[] | null = null): EmailRecipient[] {
        const recipients: EmailRecipient[] = [];

        const shared: Replacement[] = [];
        shared.push(Replacement.create({
            token: 'firstNameMember',
            value: this.firstName,
        }));

        shared.push(Replacement.create({
            token: 'lastNameMember',
            value: this.details.lastName ?? '',
        }));

        /* shared.push(Replacement.create({
            token: 'outstandingBalance',
            value: Formatter.price(this.outstandingBalance),
        })); */

        if (this.details.email && (subtypes === null || subtypes.includes('member'))) {
            recipients.push(
                EmailRecipient.create({
                    objectId: this.id,
                    memberId: this.id,
                    userId: this.users.find(u => u.email === this.details.email)?.id ?? this.users.find(u => !!this.details.alternativeEmails.find(e => e === u.email))?.id ?? null,
                    firstName: this.details.firstName,
                    lastName: this.details.lastName,
                    email: this.details.email,
                    replacements: [
                        ...shared,
                    ],
                }),
            );
        }

        // Always add one without email and user. This one will be visible in the member portal by default if no userId/email match is found
        if (subtypes === null || subtypes.includes('member')) {
            recipients.push(
                EmailRecipient.create({
                    objectId: this.id,
                    memberId: this.id,
                    firstName: this.details.firstName,
                    lastName: this.details.lastName,
                    email: null,
                    replacements: [
                        ...shared,
                    ],
                }),
            );
        }

        if (subtypes === null || subtypes.includes('parents')) {
            for (const parent of this.details.parents) {
                if (parent.email) {
                    recipients.push(
                        EmailRecipient.create({
                            objectId: this.id,
                            memberId: this.id,
                            userId: this.users.find(u => u.email === parent.email)?.id ?? this.users.find(u => !!parent.alternativeEmails.find(e => e === u.email))?.id ?? null,
                            firstName: parent.firstName,
                            lastName: parent.lastName,
                            email: parent.email,
                            replacements: [
                                ...shared,
                            ],
                        }),
                    );
                }
            }
        }

        if (subtypes && subtypes.includes('unverified')) {
            for (const unverifiedEmail of this.details.unverifiedEmails) {
                recipients.push(
                    EmailRecipient.create({
                        objectId: this.id,
                        memberId: this.id,
                        userId: this.users.find(u => u.email === unverifiedEmail)?.id ?? null,
                        email: unverifiedEmail,
                        replacements: [
                            ...shared,
                        ],
                    }),
                );
            }
        }

        return recipients;
    }
}

export class MembersBlob extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(MemberWithRegistrationsBlob) })
    members: MemberWithRegistrationsBlob[] = [];

    @field({ decoder: new ArrayDecoder(Organization) })
    organizations: Organization[] = [];

    /**
     * Timestamp on which the backend constructed this blob
     *
     * This is encoded, so it can be stored locally
     */
    @field({ decoder: DateDecoder, version: 329 })
    receivedAt = new Date();

    markReceivedFromBackend() {
        this.receivedAt = new Date();
    }

    get isStale() {
        return MembersBlob.lastPatchedMembersDate !== null && this.receivedAt < MembersBlob.lastPatchedMembersDate;
    }

    static lastPatchedMembersDate: Date | null = null;

    static markAllStale() {
        MembersBlob.lastPatchedMembersDate = new Date();
    }
}
