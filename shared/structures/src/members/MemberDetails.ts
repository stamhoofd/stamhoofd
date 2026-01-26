import { ArrayDecoder, AutoEncoder, AutoEncoderPatchType, BooleanDecoder, DateDecoder, EnumDecoder, field, IntegerDecoder, MapDecoder, PatchableArray, PatchableArrayAutoEncoder, StringDecoder, SymbolDecoder } from '@simonbackx/simple-encoding';
import { DataValidator, Formatter, Sorter, StringCompare } from '@stamhoofd/utility';

import { Address } from '../addresses/Address.js';
import { Replacement } from '../endpoints/EmailRequest.js';

import { AuditLogReplacement } from '../AuditLogReplacement.js';
import { Group } from '../Group.js';
import { GroupGenderType } from '../GroupGenderType.js';
import { EmergencyContact } from './EmergencyContact.js';
import { Gender } from './Gender.js';
import { NationalRegisterNumberOptOut } from './NationalRegisterNumberOptOut.js';
import { Parent } from './Parent.js';
import { RecordAnswer, RecordAnswerDecoder } from './records/RecordAnswer.js';
import { ReviewTimes } from './ReviewTime.js';
import { UitpasNumberDetails, UitpasSocialTariff, UitpasSocialTariffStatus } from './UitpasNumberDetails.js';

/**
 * Keep track of date nad time of an edited boolean value
 */
export class BooleanStatus extends AutoEncoder {
    @field({ decoder: BooleanDecoder })
    value = false;

    @field({ decoder: DateDecoder })
    date = new Date();

    isOutdated(timeoutMs: number): boolean {
        const time = this.date;
        if (time.getTime() < new Date().getTime() - timeoutMs) {
            return true;
        }
        return false;
    }

    getDiffValue() {
        return this.value ? AuditLogReplacement.key('checked') : AuditLogReplacement.key('unchecked');
    }
}

export type MemberProperty = 'birthDay' | 'gender' | 'address' | 'parents' | 'emailAddress' | 'phone' | 'emergencyContacts' | 'dataPermission' | 'financialSupport' | 'uitpasNumber' | 'nationalRegisterNumber' | 'parents.nationalRegisterNumber' | 'email';
export type MemberPropertyWithFilter = Exclude<MemberProperty, 'dataPermission' | 'financialSupport' | 'parents.nationalRegisterNumber'>;
/**
 * This full model is always encrypted before sending it to the server. It is never processed on the server - only in encrypted form.
 * The public key of the member is stored in the member model, the private key is stored in the keychain for the 'owner' users. The organization has a copy that is encrypted with the organization's public key.
 * Validation needs to happen mostly client side - but malicious users can just send invalid data in the encrypted form. So validation happens a second time on the client side when an organitiona's admin decrypts the member data.
 */
export class MemberDetails extends AutoEncoder {
    @field({ decoder: StringDecoder })
    firstName = '';

    @field({ decoder: StringDecoder })
    lastName = '';

    @field({ decoder: StringDecoder, version: 30, nullable: true })
    memberNumber: string | null = null;

    /**
     * In case the member has been merged with other members, this array contains a list
     * of the old ids of the members that were merged into this member.
     */
    @field({ decoder: new ArrayDecoder(StringDecoder), version: 378 })
    oldIds: string[] = [];

    /**
     * Note: when this is set to 'NationalRegisterNumberOptOut' it means the user manually opted out - and doesn't have a national register number
     */
    @field({ decoder: StringDecoder, version: 348, nullable: true })
    @field({
        decoder: new SymbolDecoder(StringDecoder, NationalRegisterNumberOptOut),
        version: 349,
        nullable: true,
        downgrade: (n: string | typeof NationalRegisterNumberOptOut | null) => n === NationalRegisterNumberOptOut ? null : n,
    })
    nationalRegisterNumber: string | typeof NationalRegisterNumberOptOut | null = null;

    /**
     * Code needed to get access to this member when detecting duplicates. It is only visible for admins, otherwise it will be null.
     *
     * Set this value if you want to gain access to a member but receive the known_member_missing_rights error code
     */
    @field({ decoder: StringDecoder, nullable: true, version: 331 })
    securityCode: string | null = null;

    @field({ decoder: DateDecoder, optional: true, nullable: true })
    lastExternalSync?: Date | null;

    @field({ decoder: new EnumDecoder(Gender) })
    gender: Gender = Gender.Other;

    @field({ decoder: StringDecoder, nullable: true })
    phone: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, field: 'mail' })
    @field({ decoder: StringDecoder, nullable: true, version: 5 })
    email: string | null = null;

    @field({ decoder: new ArrayDecoder(StringDecoder), version: 277 })
    alternativeEmails: string[] = [];

    @field({ decoder: new ArrayDecoder(StringDecoder), version: 304 })
    unverifiedEmails: string[] = [];

    @field({ decoder: new ArrayDecoder(StringDecoder), version: 304 })
    unverifiedPhones: string[] = [];

    @field({ decoder: new ArrayDecoder(Address), version: 304 })
    unverifiedAddresses: Address[] = [];

    @field({ decoder: StringDecoder, nullable: true, version: 301 })
    notes: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 306, field: 'uitpasNumber' })
    @field({
        decoder: UitpasNumberDetails,
        nullable: true,
        version: 391,
        upgrade: (old: string | null) => {
            if (old) {
                return UitpasNumberDetails.create({
                    uitpasNumber: old,
                    socialTariff: UitpasSocialTariff.create({
                        status: UitpasSocialTariffStatus.Unknown,
                    }),
                });
            }

            return null;
        },
        downgrade(newer: UitpasNumberDetails | null) {
            if (newer) {
                return newer.uitpasNumber;
            }
            return null;
        },
    })
    uitpasNumberDetails: UitpasNumberDetails | null = null;

    @field({ decoder: DateDecoder })
    @field({ decoder: DateDecoder, nullable: true, version: 52, downgrade: (old: Date | null) => old ?? new Date('1970-01-01') })
    birthDay: Date | null = null;

    @field({ decoder: IntegerDecoder, nullable: true, version: 352 })
    trackingYear: number | null = null;

    @field({ decoder: Address, nullable: true })
    address: Address | null = null;

    @field({ decoder: new ArrayDecoder(Parent) })
    parents: Parent[] = [];

    @field({ decoder: new ArrayDecoder(EmergencyContact) })
    emergencyContacts: EmergencyContact[] = [];

    @field({ decoder: new ArrayDecoder(RecordAnswerDecoder), version: 120 })
    @field({
        decoder: new MapDecoder(StringDecoder, RecordAnswerDecoder),
        version: 252,
        upgrade: (old: RecordAnswer[]) => {
            const map = new Map<string, RecordAnswer>();
            for (const answer of old) {
                map.set(answer.settings.id, answer);
            }
            return map;
        },
    })
    recordAnswers: Map<string, RecordAnswer> = new Map();

    @field({ decoder: BooleanStatus, version: 117, optional: true })
    @field({
        decoder: BooleanStatus,
        version: 258,
        optional: false,
        nullable: true,
        downgrade: (newValue: BooleanStatus | null) => newValue === null ? undefined : newValue,
        upgrade: (oldValue: BooleanStatus | undefined) => {
            if (!oldValue) {
                return null;
            }
            return oldValue;
        },
    })
    requiresFinancialSupport: BooleanStatus | null = null;

    /**
     * Indicates whether parents can have access to the members data and receive notification emails.
     * When set to false, the account of parents won't be linked to the member.
     * Also when not set, parents will have acess until the member reaches the age of 18.
     */
    @field({ decoder: BooleanStatus, nullable: true, version: 388 })
    parentsHaveAccess: BooleanStatus | null = null;

    /**
     * Gave permission to collect sensitive information
     */
    @field({ decoder: BooleanStatus, version: 117, optional: true })
    @field({
        decoder: BooleanStatus,
        version: 256,
        optional: true,
        nullable: true,
        downgrade: (newValue: BooleanStatus | null) => newValue === null ? undefined : newValue,
        upgrade: (oldValue: BooleanStatus | undefined) => {
            if (!oldValue) {
                return null;
            }
            return oldValue;
        },
    })
    dataPermissions: BooleanStatus | null = null;

    /**
     * Last time the records were reviewed
     */
    @field({ decoder: DateDecoder, nullable: true, version: 20, field: 'lastReviewed' })
    @field({ decoder: ReviewTimes, version: 71, upgrade: (oldDate: Date | null) => {
        const times = ReviewTimes.create({});
        if (oldDate) {
            times.markReviewed('records', oldDate);
            times.markReviewed('parents', oldDate);
            times.markReviewed('emergencyContacts', oldDate);
            times.markReviewed('details', oldDate);
        }
        return times;
    } })
    reviewTimes = ReviewTimes.create({});

    /**
     * Call this to clean up capitals in all the available data
     */
    cleanData() {
        if (StringCompare.isFullCaps(this.firstName)) {
            this.firstName = Formatter.capitalizeWords(Formatter.removeDuplicateSpaces(this.firstName.toLowerCase()));
        }
        if (StringCompare.isFullCaps(this.lastName)) {
            this.lastName = Formatter.capitalizeWords(Formatter.removeDuplicateSpaces(this.lastName.toLowerCase()));
        }

        this.firstName = Formatter.capitalizeFirstLetter(Formatter.removeDuplicateSpaces(this.firstName.trim()));
        this.lastName = Formatter.removeDuplicateSpaces(this.lastName.trim());

        if (this.lastName === this.lastName.toLocaleLowerCase()) {
            // Add auto capitals
            this.lastName = Formatter.capitalizeWords(this.lastName);
        }

        for (const parent of this.parents) {
            parent.cleanData();
        }

        this.address?.cleanData();

        for (const contact of this.emergencyContacts) {
            contact.cleanData();
        }

        // Remove email address on member if it was set on a parent too
        if (this.email !== null) {
            this.email = this.email.toLowerCase().trim();

            for (const parent of this.parents) {
                if (parent.hasEmail(this.email)) {
                    this.email = null;
                    break;
                }
            }
            if (!this.email || !DataValidator.isEmailValid(this.email)) {
                this.email = null;
            }
        }

        const filterUsedAndInvalidEmails = (emails: string[], checkAlternative = true) =>
            emails
                .map(e => e.toLowerCase().trim())
                .filter((email) => {
                    if (checkAlternative) {
                        if (this.hasEmail(email)) {
                            return false;
                        }
                    }
                    else {
                        if (this.email && email === this.email) {
                            return false;
                        }

                        for (const parent of this.parents) {
                            if (parent.hasEmail(email)) {
                                return false;
                            }
                        }
                    }

                    if (!DataValidator.isEmailValid(email)) {
                        return false;
                    }

                    return true;
                });

        this.alternativeEmails = filterUsedAndInvalidEmails(this.alternativeEmails, false);

        if (this.phone) {
            const formattedPhone = Formatter.removeDuplicateSpaces(this.phone.trim());
            if (formattedPhone !== this.phone) {
                this.phone = formattedPhone;
            }

            for (const parent of this.parents) {
                if (parent.phone === this.phone) {
                    this.phone = null;
                    break;
                }
            }
        }

        // #region unverified data
        if (this.hasUnverifiedData) {
            const lastReviewed = this.reviewTimes.getLastReview('parents') && this.reviewTimes.getLastReview('details');

            if (lastReviewed && lastReviewed > new Date((new Date().getTime() - 1000 * 60 * 60 * 24))) {
                // clear unverified data only if reviewed today
                this.unverifiedAddresses = [];
                this.unverifiedEmails = [];
                this.unverifiedPhones = [];
            }
            else {
                // #region filter used unverified addresses
                const usedAddressIds = new Set<string>();
                if (this.unverifiedAddresses.length > 0) {
                    const memberAddressId = this.address?.id;
                    const parentAddressIds = this.parents.filter(parent => parent.address).map(parent => parent.address!.id);

                    for (const unverifiedAddress of this.unverifiedAddresses) {
                        unverifiedAddress.cleanData();
                        const addressId = unverifiedAddress.id;
                        const isUsed = addressId === memberAddressId || parentAddressIds.includes(addressId);
                        if (isUsed) {
                            usedAddressIds.add(addressId);
                        }
                    }

                    if (usedAddressIds.size > 0) {
                        this.unverifiedAddresses = this.unverifiedAddresses.filter(address => !usedAddressIds.has(address.id));
                    }
                }
                // #endregion

                // filter uncatetorized emails
                this.unverifiedEmails = filterUsedAndInvalidEmails(this.unverifiedEmails);

                // #region filter unverified phones
                if (this.unverifiedPhones.length > 0) {
                    const parentPhones = new Set<string>();
                    for (const parent of this.parents) {
                        const parentPhone = parent.phone;
                        if (parentPhone) parentPhones.add(parentPhone);
                    }

                    this.unverifiedPhones = this.unverifiedPhones
                        .map(phone => Formatter.removeDuplicateSpaces(phone.trim()))
                        .filter((unverifiedPhone) => {
                            if (this.phone === unverifiedPhone) return false;
                            if (parentPhones.has(unverifiedPhone)) return false;
                            return true;
                        });
                }
                // #endregion
            }
        }
        // #endregion

        if (this.notes !== null) {
            // cut long notes
            if (this.notes.length > 1000) {
                this.notes = this.notes.substring(0, 1000);
            }

            // remove empty notes
            if (/^\s*$/.test(this.notes)) {
                this.notes = null;
            }
        }

        if (this.trackingYear && this.birthDay) {
            if (this.trackingYear === this.birthDay.getFullYear()) {
                // tracking year is not needed
                this.trackingYear = null;
            }
        }
    }

    get name() {
        if (!this.firstName) {
            return this.lastName;
        }
        if (!this.lastName) {
            return this.firstName;
        }
        return this.firstName + ' ' + this.lastName;
    }

    /// The age this member will become according to his tracking year or birth year, this year
    trackedAgeForYear(year: number): number | null {
        if (this.trackingYear) {
            return year - this.trackingYear;
        }

        if (!this.birthDay) {
            return null;
        }
        // For now calculate based on Brussels timezone (we'll need to correct this later)
        const birthDay = Formatter.luxon(this.birthDay);
        return year - birthDay.year;
    }

    ageOnDate(date: Date): number | null {
        if (!this.birthDay) {
            return null;
        }

        // For now calculate based on Brussels timezone (we'll need to correct this later)
        const birthDay = Formatter.luxon(this.birthDay);
        let age = date.getFullYear() - birthDay.year;
        const m = date.getMonth() - (birthDay.month - 1);
        if (m < 0 || (m === 0 && date.getDate() < birthDay.day)) {
            age--;
        }
        return age;
    }

    get age(): number | null {
        return this.ageOnDate(new Date());
    }

    get calculatedParentsHaveAccess(): boolean {
        if (this.parentsHaveAccess) {
            return this.parentsHaveAccess.value;
        }
        return this.defaultAge < 18;
    }

    /**
     * Age, set to 99 if missing
     */
    get defaultAge() {
        return this.age ?? 99;
    }

    get birthDayFormatted(): string | null {
        if (!this.birthDay) {
            return null;
        }

        return Formatter.date(this.birthDay, true);
    }

    get hasUnverifiedData() {
        return this.unverifiedEmails.length > 0 || this.unverifiedAddresses.length > 0 || this.unverifiedPhones.length > 0;
    }

    get hasFinancialSupportOrActiveUitpas(): boolean {
        return this.requiresFinancialSupport?.value === true || this.uitpasNumberDetails?.socialTariff.status === UitpasSocialTariffStatus.Active;
    }

    get shouldApplyReducedPrice(): boolean {
        return this.hasFinancialSupportOrActiveUitpas;
    }

    get missingData(): (MemberProperty | 'secondParent')[] {
        const missing: (MemberProperty | 'secondParent') [] = [];
        if (!this.birthDay) {
            missing.push('birthDay');
        }

        if (!this.address) {
            missing.push('address');
        }

        if (!this.phone) {
            missing.push('phone');
        }

        if (!this.email) {
            missing.push('email');
        }

        if (this.parents.length === 0) {
            missing.push('parents');
        }

        if (this.parents.length === 1) {
            missing.push('secondParent');
        }

        if (this.emergencyContacts.length === 0) {
            missing.push('emergencyContacts');
        }
        return missing;
    }

    /**
     * Check if this member could fit a group, ignoring dates and waiting lists
     */
    doesMatchGroup(group: Group) {
        return this.getMatchingError(group) === null;
    }

    getMatchingError(group: Group): { message: string; description: string } | null {
        if (group.settings.minAge || group.settings.maxAge) {
            const age = this.trackedAgeForYear(Formatter.luxon(group.settings.startDate ?? new Date()).year);
            if (age) {
                if (group.settings.minAge && age < group.settings.minAge) {
                    return {
                        message: $t(`02313223-edde-443f-8620-8951e696e77e`),
                        description: $t(`121a5916-44ab-4870-9182-ffc53be0ceb2`, {
                            'firstName': this.firstName,
                            'born-in-after-1995': group.settings.getAgeGenderDescription({ includeAge: true }) ?? '',
                        }),
                    };
                }

                if (group.settings.maxAge && age > group.settings.maxAge) {
                    return {
                        message: $t(`af16be1f-5031-4d6d-82f6-85f63fa17500`),
                        description: $t(`121a5916-44ab-4870-9182-ffc53be0ceb2`, {
                            'firstName': this.firstName,
                            'born-in-after-1995': group.settings.getAgeGenderDescription({ includeAge: true }) ?? '',
                        }),
                    };
                }
            }
        }

        if ((this.gender === Gender.Male && group.settings.genderType === GroupGenderType.OnlyFemale) || (this.gender === Gender.Female && group.settings.genderType === GroupGenderType.OnlyMale)) {
            return {
                message: $t(`99785e34-7587-4be9-bd43-b57dcb63b4a7`, { gender: group.settings.getAgeGenderDescription({ includeGender: true })! }),
                description: $t(`f1a4bbb9-1fa7-429b-b498-a902f68cb679`, { gender: group.settings.getAgeGenderDescription({ includeGender: true })! }),
            };
        }

        return null;
    }

    getMatchingGroups(groups: Group[]) {
        return groups.filter(g => this.doesMatchGroup(g));
    }

    updateAddress(oldValue: Address, newValue: Address) {
        const str = oldValue.toString();

        if (this.address && this.address.toString() == str) {
            this.address = newValue;
        }

        for (const parent of this.parents) {
            if (parent.address && parent.address.toString() == str) {
                parent.address = newValue;
            }
        }
    }

    updateAddressPatch(oldValue: Address, newValue: Address): AutoEncoderPatchType<MemberDetails> | null {
        if (newValue.toString() === oldValue.toString()) {
            return null;
        }

        const str = oldValue.toString();
        let patch = MemberDetails.patch({});
        let changed = false;

        if (this.address && this.address.toString() === str) {
            patch = patch.patch({ address: newValue });
            changed = true;
        }

        for (const parent of this.parents) {
            if (parent.address && parent.address.toString() === str) {
                // parent.address = newValue
                const arr = new PatchableArray() as PatchableArrayAutoEncoder<Parent>;
                arr.addPatch(Parent.patch({ id: parent.id, address: newValue }));
                patch = patch.patch({ parents: arr });
                changed = true;
            }
        }

        if (changed) {
            return patch;
        }
        return null;
    }

    /**
     * This will add or update the parent (possibily partially if not all data is present)
     */
    addParent(parent: Parent) {
        // Multiple loops to mangage priority
        for (const [index, _parent] of this.parents.entries()) {
            if (_parent.id == parent.id) {
                this.parents[index].merge(parent);
                return;
            }
        }

        for (const [index, _parent] of this.parents.entries()) {
            // clean both parents before checking
            parent.cleanData();
            _parent.cleanData();

            if (_parent.name && parent.name) {
                if (StringCompare.typoCount(_parent.name, parent.name) === 0) {
                    this.parents[index].merge(parent);
                    return;
                }
            }
        }

        for (const [index, _parent] of this.parents.entries()) {
            if (_parent.name && parent.name) {
                if (StringCompare.typoCount(_parent.name, parent.name) < 2) {
                    this.parents[index].merge(parent);
                    return;
                }
            }
        }

        for (const [index, _parent] of this.parents.entries()) {
            if (!_parent.name || !parent.name) {
                if (_parent.email && parent.email) {
                    // Compare on email address
                    if (_parent.email == parent.email) {
                        this.parents[index].merge(parent);
                        return;
                    }
                }
                if (_parent.phone && parent.phone) {
                    if (_parent.phone == parent.phone) {
                        this.parents[index].merge(parent);
                        return;
                    }
                }
            }
        }
        this.parents.push(parent);
    }

    getShortCode(maxLength: number) {
        return Formatter.firstLetters(this.firstName, maxLength);
    }

    /**
     * Apply newer details without deleting data or replacing filled in data with empty data
     */
    merge(other: MemberDetails) {
        if (other.firstName.length > 0) {
            this.firstName = other.firstName;
        }

        if (other.lastName.length > 0) {
            this.lastName = other.lastName;
        }

        if (other.email) {
            this.email = other.email;
        }

        if (other.birthDay) {
            this.birthDay = other.birthDay;
        }

        if (other.gender !== Gender.Other) {
            // Always copy gender
            this.gender = other.gender;
        }

        if (other.address) {
            if (this.address) {
                this.updateAddress(this.address, other.address);
            }
            else {
                this.address = other.address;
            }
        }

        if (other.phone) {
            this.phone = other.phone;
        }

        if (other.memberNumber) {
            this.memberNumber = other.memberNumber;
        }

        if (other.parents.length > 0) {
            for (const parent of other.parents) {
                // Will override existing parent if possible
                this.addParent(parent);
            }
        }

        if (other.emergencyContacts.length > 0) {
            this.emergencyContacts = other.emergencyContacts;
        }

        this.reviewTimes.merge(other.reviewTimes);

        if (other.requiresFinancialSupport && (!this.requiresFinancialSupport || this.requiresFinancialSupport.date < other.requiresFinancialSupport.date)) {
            this.requiresFinancialSupport = other.requiresFinancialSupport;
        }

        if ((other.uitpasNumberDetails?.socialTariff?.updatedAt.getTime() ?? 0) >= (this.uitpasNumberDetails?.socialTariff?.updatedAt.getTime() ?? 0)) {
            this.uitpasNumberDetails = other.uitpasNumberDetails;
        }

        if (other.dataPermissions && (!this.dataPermissions || this.dataPermissions.date < other.dataPermissions.date)) {
            this.dataPermissions = other.dataPermissions;
        }

        // Merge answers
        const newAnswers: Map<string, RecordAnswer> = new Map(this.recordAnswers);
        for (const answer of other.recordAnswers.values()) {
            const existing = newAnswers.get(answer.settings.id);

            if (!existing) {
                newAnswers.set(answer.settings.id, answer);
            }
            else if (answer.date >= existing.date) {
                newAnswers.set(answer.settings.id, answer);
            }
            else {
                // keep existing, this one is more up-to-date, don't add the other answer
            }
        }
        this.recordAnswers = newAnswers;

        // Merge unverified data
        this.unverifiedEmails = Formatter.uniqueArray(this.unverifiedEmails.concat(other.unverifiedEmails));
        this.unverifiedPhones = Formatter.uniqueArray(this.unverifiedPhones.concat(other.unverifiedPhones));

        // Merge unverified addresses
        for (const address of other.unverifiedAddresses) {
            if (!this.unverifiedAddresses.find(a => a.id === address.id)) {
                this.unverifiedAddresses.push(address);
            }
        }

        // Notes
        if (other.notes) {
            this.notes = (this.notes ? (this.notes + '\n') : '') + other.notes;
        }
    }

    getEmailReplacements() {
        return [
            Replacement.create({
                token: 'memberFirstName',
                value: this.firstName,
            }),
            Replacement.create({
                token: 'memberLastName',
                value: this.lastName,
            }),
        ];
    }

    getMemberEmails() {
        const userEmails = [...this.alternativeEmails];

        if (this.email) {
            userEmails.unshift(this.email);
        }

        return userEmails;
    }

    getParentEmails() {
        return this.parents.flatMap(p => p.getEmails());
    }

    getNotificationEmails() {
        const emails: string[] = [];

        const m = this.getMemberEmails();
        if (m.length) {
            // Only the first email address of parents
            emails.push(m[0].toLocaleLowerCase());
        }
        else {
            // Add all unverified email addresses (one will be right hopefully)
            if (this.unverifiedEmails.length) {
                emails.push(...this.unverifiedEmails);
            }
        }

        if (this.calculatedParentsHaveAccess) {
            // Only the first email address of parents
            emails.push(
                ...this.parents.flatMap((p) => {
                    const q = p.getEmails();
                    if (q.length) {
                        return [q[0].toLocaleLowerCase()];
                    }
                    return [];
                }),
            );
        }

        return emails;
    }

    hasEmail(email: string) {
        const cleanedEmail = email.toLowerCase().trim();
        return this.getMemberEmails().includes(cleanedEmail) || this.getParentEmails().includes(cleanedEmail);
    }

    getAllAddresses() {
        const addresses: Address[] = [];

        if (this.address) {
            addresses.push(this.address);
        }

        for (const parent of this.parents) {
            if (parent.address && !addresses.find(a => a.id === parent.address!.id)) {
                addresses.push(parent.address);
            }
        }

        for (const address of this.unverifiedAddresses) {
            if (!addresses.find(a => a.id === address.id)) {
                addresses.push(address);
            }
        }

        return addresses;
    }

    static mergeParents(members: MemberDetails[], allowOverrides = true) {
        return MemberDetails.mergeRelations(members, 'parents', allowOverrides);
    }

    static mergeEmergencyContacts(members: MemberDetails[], allowOverrides = true) {
        return MemberDetails.mergeRelations(members, 'emergencyContacts', allowOverrides);
    }

    private static mergeRelations(members: MemberDetails[], type: 'parents' | 'emergencyContacts', allowOverrides = true) {
        type T = Parent | EmergencyContact;
        type RelationGroup = { object: T; reviewDate?: Date; createdAt: Date; setObject: (object: T) => void }[];

        const allGroups: RelationGroup[] = [];
        const parentsGroupByName: Map<string, RelationGroup> = new Map();
        const parentsGroupById: Map<string, RelationGroup> = new Map();
        const mergeIdMap: Map<string, string> = new Map();

        for (const member of members) {
            for (const [index, object] of (member[type] as T[]).entries()) {
                if (object.name.length <= 3) {
                    continue;
                }

                // First find group by ID, then name
                let group = parentsGroupById.get(object.id) ?? parentsGroupByName.get(object.name);
                if (!group) {
                    group = [];
                    allGroups.push(group);
                }

                // Save name and id groups
                if (!parentsGroupByName.has(object.name)) {
                    parentsGroupByName.set(object.name, group);
                }
                if (!parentsGroupById.has(object.id)) {
                    parentsGroupById.set(object.id, group);
                }

                group.push({
                    object: object,
                    setObject(object: T) {
                        member[type][index] = object;
                    },
                    reviewDate: object.updatedAt ?? member.reviewTimes.getLastReview(type) ?? object.createdAt,
                    createdAt: object.createdAt,
                });
            }
        }

        // Sort each parent by review date and merge
        for (const parents of allGroups) {
            if (parents.length >= 2) {
                // Fetch parent with oldest createdAt
                // This is so we can keep the oldest createdAt and oldest id
                parents.sort((a, b) => Sorter.byDateValue(
                    b.createdAt,
                    a.createdAt,
                ));
                const oldestParent = parents[0].object;

                // Sort from oldest reviewed to latest reviewed
                parents.sort((a, b) => Sorter.byDateValue(b.reviewDate ?? new Date(0), a.reviewDate ?? new Date(0)));

                // Parents with the same id override each other, while parents with different ids merge while maintaining as much data as possible
                // this happens in groups
                let mergeTo = parents[0].object.clone();
                const remaining = parents.slice(1);
                let allowSet = true; // Only the first 'streak' of parents with the same id override mergeTo

                for (const [index, { object }] of remaining.entries()) {
                    if (allowSet && object.id === mergeTo.id && allowOverrides) {
                        mergeTo = object.clone();
                        continue;
                    }
                    else {
                        allowSet = false;
                    }
                    if (allowOverrides) {
                        if (index < remaining.length - 1) {
                            const nextParent = remaining[index + 1].object;
                            // If the next parent has the same id, we'll simply ignore this parent because it is out of date.
                            // This is different from setting mergeTo because we'll still merge with the previous parents that had a different id
                            if (object.id === nextParent.id) {
                                continue;
                            }
                        }
                    }

                    // TypeScript does not understand the complexity here, so'll need to help it understand mergeTo is always the same type as object
                    mergeTo.merge(object as EmergencyContact & Parent);
                }

                // Force set id + createdAt
                mergeTo.id = oldestParent.id;
                mergeTo.createdAt = oldestParent.createdAt;

                for (const { object, setObject } of parents) {
                    if (object.id !== mergeTo.id) {
                        mergeIdMap.set(object.id, mergeTo.id);
                    }
                    setObject(mergeTo);
                }

                // Remove duplicate parents by id for each member
                for (const member of members) {
                    member[type] = member[type].filter((p, i, self) => self.findIndex(p2 => p2.id === p.id) === i) as any;
                }
            }
        }

        return mergeIdMap;
    }
}
