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

    @field({ decoder: new ArrayDecoder(GenericBalance), ...NextVersion })
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

        const createLoginDetailsReplacement = (email: string) => {
            const formattedEmail = Formatter.escapeHtml(email);

            let suffix = '';

            if (this.details.securityCode) {
                suffix = ` De beveiligingscode voor ${Formatter.escapeHtml(this.firstName)} is <span class="style-inline-code">${Formatter.escapeHtml(Formatter.spaceString(this.details.securityCode, 4, '-'))}</span>.`;
            }

            return Replacement.create({
                token: 'loginDetails',
                value: '',
                html: this.hasAccount(email) ? `<p class="description"><em>${$t('467951bf-92b1-417b-a56b-19ce254c3571')} <strong>${formattedEmail}</strong>.${suffix}</em></p>` : `<p class="description"><em>${$t('3c710008-5f1f-477b-9ba3-b355d47bf858')} <strong>${formattedEmail}</strong>${$t('adc70733-1f21-4e69-9b90-e56d5a80a6d6')}${suffix}</em></p>`,
            });
        };

        if (this.details.email && (subtypes === null || subtypes.includes('member'))) {
            recipients.push(
                EmailRecipient.create({
                    objectId: this.id,
                    firstName: this.details.firstName,
                    lastName: this.details.lastName,
                    email: this.details.email,
                    replacements: [
                        createLoginDetailsReplacement(this.details.email),
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
                            firstName: parent.firstName,
                            lastName: parent.lastName,
                            email: parent.email,
                            replacements: [
                                createLoginDetailsReplacement(parent.email),
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
                        email: unverifiedEmail,
                        replacements: [
                            Replacement.create({
                                token: 'email',
                                value: unverifiedEmail.toLowerCase(),
                            }),
                            createLoginDetailsReplacement(unverifiedEmail),
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
