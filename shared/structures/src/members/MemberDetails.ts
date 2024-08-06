import { ArrayDecoder, AutoEncoder, AutoEncoderPatchType, BooleanDecoder, DateDecoder, EnumDecoder, field, MapDecoder, PatchableArray, PatchableArrayAutoEncoder, StringDecoder } from '@simonbackx/simple-encoding';
import { DataValidator, Formatter, StringCompare } from '@stamhoofd/utility';

import { Address } from '../addresses/Address';
import { Replacement } from '../endpoints/EmailRequest';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Group } from '../Group';
import { GroupGenderType } from '../GroupGenderType';
import { EmergencyContact } from './EmergencyContact';
import { Gender } from './Gender';
import { Parent } from './Parent';
import { RecordAnswer, RecordAnswerDecoder } from './records/RecordAnswer';
import { ReviewTimes } from './ReviewTime';

/**
 * Keep track of date nad time of an edited boolean value
 */
export class BooleanStatus extends AutoEncoder {
    @field({ decoder: BooleanDecoder })
    value = false

    @field({ decoder: DateDecoder })
    date = new Date()

    isOutdated(timeoutMs: number): boolean {
        const time = this.date
        if (time.getTime() < new Date().getTime() - timeoutMs) {
            return true
        }
        return false
    }
}

/**
 * This full model is always encrypted before sending it to the server. It is never processed on the server - only in encrypted form. 
 * The public key of the member is stored in the member model, the private key is stored in the keychain for the 'owner' users. The organization has a copy that is encrypted with the organization's public key.
 * Validation needs to happen mostly client side - but malicious users can just send invalid data in the encrypted form. So validation happens a second time on the client side when an organitiona's admin decrypts the member data.
 */
export class MemberDetails extends AutoEncoder {
    @field({ decoder: StringDecoder })
    firstName = "";

    @field({ decoder: StringDecoder })
    lastName = "";

    @field({ decoder: StringDecoder, version: 30, nullable: true })
    memberNumber: string | null = null;

    @field({ decoder: DateDecoder, optional: true, nullable: true })
    lastExternalSync?: Date | null

    @field({ decoder: new EnumDecoder(Gender) })
    gender: Gender = Gender.Other;

    @field({ decoder: StringDecoder, nullable: true })
    phone: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, field: "mail" })
    @field({ decoder: StringDecoder, nullable: true, version: 5 })
    email: string | null = null;

    @field({ decoder: new ArrayDecoder(StringDecoder), version: 277 })
    alternativeEmails: string[] = []

    /**
     * These emails will get access to the member if parentsHaveAccess is true
     */
    @field({decoder: new ArrayDecoder(StringDecoder), version: 296})
    uncategorizedEmails: string[] = []

    @field({decoder: new ArrayDecoder(StringDecoder), version: 296})
    uncategorizedPhones: string[] = []

    @field({decoder: new ArrayDecoder(Address), version: 296})
    uncategorizedAddresses: Address[] = []

    @field({decoder: StringDecoder, nullable: true, version: 301})
    notes: string | null = null;

    @field({ decoder: DateDecoder })
    @field({ decoder: DateDecoder, nullable: true, version: 52, downgrade: (old: Date | null) => old ?? new Date("1970-01-01") })
    birthDay: Date | null = null

    @field({ decoder: Address, nullable: true })
    address: Address | null = null;

    @field({ decoder: new ArrayDecoder(Parent)})
    parents: Parent[] = [];

    @field({ decoder: new ArrayDecoder(EmergencyContact) })
    emergencyContacts: EmergencyContact[] = [];

    @field({ decoder: new ArrayDecoder(RecordAnswerDecoder), version: 120 })
    @field({ 
        decoder: new MapDecoder(StringDecoder, RecordAnswerDecoder), 
        version: 252, 
        upgrade: (old: RecordAnswer[]) => {
            const map = new Map<string, RecordAnswer>()
            for (const answer of old) {
                map.set(answer.settings.id, answer)
            }
            return map;
        } 
    })
    recordAnswers: Map<string, RecordAnswer> = new Map()

    @field({ decoder: BooleanStatus, version: 117, optional: true })
    @field({ 
        decoder: BooleanStatus, 
        version: 258, 
        optional: false, 
        nullable: true,
        downgrade: (newValue: BooleanStatus | null) => newValue === null ? undefined : newValue,
        upgrade: (oldValue: BooleanStatus | undefined) => {
            if (!oldValue) {
                return null
            }
            return oldValue
        }
    })
    requiresFinancialSupport: BooleanStatus|null = null

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
                return null
            }
            return oldValue
        }
    })
    dataPermissions: BooleanStatus|null = null

    /**
     * Last time the records were reviewed
     */
    @field({ decoder: DateDecoder, nullable: true, version: 20, field: "lastReviewed" })
    @field({ decoder: ReviewTimes, version: 71, upgrade: (oldDate: Date | null) => {
        const times = ReviewTimes.create({})
        if (oldDate) {
            times.markReviewed("records", oldDate)
            times.markReviewed("parents", oldDate)
            times.markReviewed("emergencyContacts", oldDate)
            times.markReviewed("details", oldDate)
        }
        return times
    } })
    reviewTimes = ReviewTimes.create({})

    /**
     * Call this to clean up capitals in all the available data
     */
    cleanData() {
        if (StringCompare.isFullCaps(this.firstName)) {
            this.firstName = Formatter.capitalizeWords(Formatter.removeDuplicateSpaces(this.firstName.toLowerCase()))
        }
        if (StringCompare.isFullCaps(this.lastName)) {
            this.lastName = Formatter.capitalizeWords(Formatter.removeDuplicateSpaces(this.lastName.toLowerCase()))
        }

        this.firstName = Formatter.capitalizeFirstLetter(Formatter.removeDuplicateSpaces(this.firstName.trim()))
        this.lastName = Formatter.removeDuplicateSpaces(this.lastName.trim())

        if (this.lastName === this.lastName.toLocaleLowerCase()) {
            // Add auto capitals
            this.lastName = Formatter.capitalizeWords(this.lastName)
        }

        for (const parent of this.parents) {
            parent.cleanData()
        }

        this.address?.cleanData();

        for (const contact of this.emergencyContacts) {
            contact.cleanData();
        }

        // Remove email address on member if it was set on a parent too
        if (this.email !== null) {
            this.email = this.email.toLocaleLowerCase().trim()

            for (const parent of this.parents) {
                if (parent.hasEmail(this.email)) {
                    this.email = null
                    break;
                }
            }
            if (!this.email || !DataValidator.isEmailValid(this.email)) {
                this.email = null
            }
        }

        const filterUsedAndInvalidEmails = (emails: string[]) => emails
        .map(e => e.toLowerCase().trim())
        .filter(email => {
            if (this.email && email === this.email) {
                return false
            }
            if (!DataValidator.isEmailValid(email)) {
                return false
            }

            for (const parent of this.parents) {
                if (parent.hasEmail(email)) {
                    return false
                }
            }
            return true
        });

        this.alternativeEmails = filterUsedAndInvalidEmails(this.alternativeEmails);

        if (this.phone) {
            const formattedPhone = Formatter.removeDuplicateSpaces(this.phone.trim());
            if(formattedPhone !== this.phone) {
                this.phone = formattedPhone;
            }
        }

        //#region uncategorized data
        if (this.hasUncategorizedData) {
            const lastReviewed = this.reviewTimes.getLastReview("parents") && this.reviewTimes.getLastReview("details");

            if(lastReviewed) {
                // clear uncategorized data
                this.uncategorizedAddresses = [];
                this.uncategorizedEmails = [];
                this.uncategorizedPhones = [];
            } else {
                //#region filter used uncategorized addresses
                const usedAddressIds = new Set<string>();
                if(this.uncategorizedAddresses.length > 0) {
                    const memberAddressId = this.address?.id;
                    const parentAddressIds = this.parents.filter(parent => parent.address).map(parent => parent.address!.id);
                
                    for(const uncategorizedAddress of this.uncategorizedAddresses) {
                        uncategorizedAddress.cleanData();
                        const addressId = uncategorizedAddress.id;
                        const isUsed = addressId === memberAddressId || parentAddressIds.includes(addressId);
                        if(isUsed) {
                            usedAddressIds.add(addressId);
                        }
                    }
                
                    if(usedAddressIds.size > 0) {
                        this.uncategorizedAddresses = this.uncategorizedAddresses.filter(address => !usedAddressIds.has(address.id));
                    }
                }
                //#endregion

                // filter uncatetorized emails
                this.uncategorizedEmails = filterUsedAndInvalidEmails(this.uncategorizedEmails);

                //#region filter uncategorized phones
                if(this.uncategorizedPhones.length > 0 ){
                    const parentPhones = new Set<string>();
                    for(const parent of this.parents) {
                        const parentPhone = parent.phone;
                        if(parentPhone) parentPhones.add(parentPhone);
                    }

                    this.uncategorizedPhones = this.uncategorizedPhones
                    .map(phone => Formatter.removeDuplicateSpaces(phone.trim()))
                    .filter(uncategorizedPhone => {
                        if(this.phone === uncategorizedPhone) return false;
                        if(parentPhones.has(uncategorizedPhone)) return false;
                        return true;
                    });
                }
                //#endregion
            }
        }
        //#endregion
        
        if(this.notes) {
            // cut long notes
            if(this.notes.length > 1000) {
                this.notes = this.notes.substring(0, 1000);
            }

            // remove empty notes
            if(/^\s*$/.test(this.notes)) {
                this.notes = null;
            }
        }
    }

    isEqual(other: MemberDetails): boolean {
        if (!this.firstName || !other.firstName) {
            // Not possible to compare
            return false
        }

        if (!this.lastName || !other.lastName) {
            // Not possible to compare
            return false
        }

        if (!this.birthDay || !other.birthDay) {
            // Not possible to compare
            return false
        }

        if (this.firstName != other.firstName) {
            return false
        }

        if (this.lastName != other.lastName) {
            return false
        }

        if (this.birthDayFormatted != other.birthDayFormatted) {
            return false
        }

        return true;
    }

    get name() {
        if (!this.firstName) {
            return this.lastName;
        }
        if (!this.lastName) {
            return this.firstName;
        }
        return this.firstName + " " + this.lastName;
    }

    /// The age this member will become, this year
    ageForYear(year: number): number | null {
        if (!this.birthDay) {
            return null
        }
        // For now calculate based on Brussels timezone (we'll need to correct this later)
        const birthDay = Formatter.luxon(this.birthDay);
        return year - birthDay.year;
    }

    ageOnDate(date: Date): number | null {
        if (!this.birthDay) {
            return null
        }

        // For now calculate based on Brussels timezone (we'll need to correct this later)
        const birthDay = Formatter.luxon(this.birthDay);
        let age = date.getFullYear() - birthDay.year;
        const m = date.getMonth() - (birthDay.month - 1)
        if (m < 0 || (m === 0 && date.getDate() < birthDay.day)) {
            age--;
        }
        return age;
    }

    get age(): number | null {
        return this.ageOnDate(new Date);
    }

    /**
     * Age, set to 99 if missing
     */
    get defaultAge() {
        return this.age ?? 99
    }

    get birthDayFormatted(): string | null {
        if (!this.birthDay) {
            return null
        }

        return Formatter.date(this.birthDay, true);
    }

    get hasUncategorizedData() {
        return this.uncategorizedEmails.length > 0 || this.uncategorizedAddresses.length > 0 || this.uncategorizedPhones.length > 0;
    }

    matchQuery(query: string): boolean {
        if (
            StringCompare.typoCount(this.firstName, query) < 2 ||
            StringCompare.typoCount(this.lastName, query) < 2 ||
            StringCompare.typoCount(this.name, query) <= 2
        ) {
            return true;
        }

        for (const parent of this.parents) {
            if (parent.matchQuery(query)) {
                return true
            }
        }
        return false;
    }

    /**
     * Check if this member could fit a group, ignoring dates and waiting lists
     */
    doesMatchGroup(group: Group) {
        return this.getMatchingError(group) === null
    }

    getMatchingError(group: Group): {message: string, description: string} | null {
        const age = this.ageForYear(Formatter.luxon(group.settings.startDate).year)
        if (group.settings.minAge || group.settings.maxAge) {
            if (age) {
                if (group.settings.minAge && age < group.settings.minAge) {
                    return {
                        message: "Te jong",
                        description: this.firstName + " is te jong. Inschrijvingen is beperkt tot leden " + (group.settings.getAgeGenderDescription({includeAge: true}) ?? '')
                    }
                }

                if (group.settings.maxAge && age > group.settings.maxAge) {
                    return {
                        message: "Te oud",
                        description: this.firstName + " is te jong. Inschrijvingen is beperkt tot leden " + (group.settings.getAgeGenderDescription({includeAge: true}) ?? '')
                    }
                }
            }
        }

        if (this.gender == Gender.Male && group.settings.genderType == GroupGenderType.OnlyFemale) {
            return {
                message: "Enkel " + group.settings.getAgeGenderDescription({includeGender: true}),
                description: "Inschrijvingen is beperkt tot " + group.settings.getAgeGenderDescription({includeGender: true}),
            }
        }

        if (this.gender == Gender.Female && group.settings.genderType == GroupGenderType.OnlyMale) {
            return {
                message: "Enkel " + group.settings.getAgeGenderDescription({includeGender: true}),
                description: "Inschrijvingen is beperkt tot " + group.settings.getAgeGenderDescription({includeGender: true}),
            }
        }
        
        return null
    }

    getMatchingGroups(groups: Group[]) {
        return groups.filter(g => this.doesMatchGroup(g))
    }


    updateAddress(oldValue: Address, newValue: Address) {
        const str = oldValue.toString()

        if (this.address && this.address.toString() == str) {
            this.address = newValue
        }

        for (const parent of this.parents) {
            if (parent.address && parent.address.toString() == str) {
                parent.address = newValue
            }
        }
    }

    updateAddressPatch(oldValue: Address, newValue: Address): AutoEncoderPatchType<MemberDetails>|null {
        const str = oldValue.toString()
        let patch = MemberDetails.patch({})
        let changed = false

        if (this.address && this.address.toString() == str) {
            patch = patch.patch({ address: newValue })
            changed = true
        }

        for (const parent of this.parents) {
            if (parent.address && parent.address.toString() == str) {
                //parent.address = newValue
                const arr = new PatchableArray() as PatchableArrayAutoEncoder<Parent>
                arr.addPatch(Parent.patch({ id: parent.id, address: newValue }))
                patch = patch.patch({ parents: arr })
                changed = true
            }
        }

        if (changed) {
            return patch;
        }
        return null;
    }

    /**
     * This will SET the parent
     */
    updateParent(parent: Parent) {
        for (const [index, _parent] of this.parents.entries()) {
            if (_parent.id == parent.id || _parent.isEqual(parent)) {
                this.parents[index] = parent
            }
        }
    }

     /**
     * This will SET the parent
     */
     updateParentPatch(parent: Parent): AutoEncoderPatchType<MemberDetails>|null {
        let patch = MemberDetails.patch({})
        let changed = false

        for (const [index, _parent] of this.parents.entries()) {
            if (_parent.id == parent.id || _parent.isEqual(parent)) {
                const arr = new PatchableArray() as PatchableArrayAutoEncoder<Parent>
                
                // Assure we auto correct possible duplicates
                arr.addDelete(_parent.id)
                arr.addDelete(_parent.id)

                arr.addPut(parent)
                patch = patch.patch({ parents: arr })
                changed = true
            }
        }

        if (changed) {
            return patch;
        }
        return null;
    }

     /**
     * This will SET the parent
     */
    updateEmergencyContactPatch(emergencyContact: EmergencyContact): AutoEncoderPatchType<MemberDetails>|null {
        let patch = MemberDetails.patch({})
        let changed = false

        for (const [index, _emergencyContact] of this.emergencyContacts.entries()) {
            if (_emergencyContact.id == emergencyContact.id || _emergencyContact.isEqual(emergencyContact)) {
                const arr = new PatchableArray() as PatchableArrayAutoEncoder<EmergencyContact>
                
                // Assure we auto correct possible duplicates
                arr.addDelete(_emergencyContact.id)
                arr.addDelete(_emergencyContact.id)

                arr.addPut(emergencyContact)
                patch = patch.patch({ emergencyContacts: arr })
                changed = true
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
        console.log('adding parent to ', this.name)
        
        // Multiple loops to mangage priority
        for (const [index, _parent] of this.parents.entries()) {
            if (_parent.id == parent.id) {
                console.log('Merging parent on id', index, parent)
                this.parents[index].merge(parent)
                return
            }
        }

        for (const [index, _parent] of this.parents.entries()) {
            // clean both parents before checking
            parent.cleanData();
            _parent.cleanData();

            if (_parent.name && parent.name) {
                if (StringCompare.typoCount(_parent.name, parent.name) === 0) {
                    console.log('Merging parent on name', index, parent)
                    this.parents[index].merge(parent)
                    return
                }
            }
        }

        for (const [index, _parent] of this.parents.entries()) {
            if (_parent.name && parent.name) {
                if (StringCompare.typoCount(_parent.name, parent.name) < 2) {
                    console.log('Merging parent on name typo', index, parent)
                    this.parents[index].merge(parent)
                    return
                }
            }
        }

        for (const [index, _parent] of this.parents.entries()) {
            if (!_parent.name || !parent.name) {
                if (_parent.email && parent.email) {
                    // Compare on email address
                    if (_parent.email == parent.email) {
                        console.log('Merging parent on email', index, parent)
                        this.parents[index].merge(parent)
                        return
                    }
                }
                if (_parent.phone && parent.phone) {
                    if (_parent.phone == parent.phone) {
                        console.log('Merging parent on phone', index, parent)
                        this.parents[index].merge(parent)
                        return
                    }
                }
            }
        }
        this.parents.push(parent)
    }

    get canHaveOwnAccount() {
        return (this.age === null || (this.age >= 12))
    }

    get parentsHaveAccess() {
        return (this.age && (this.age < 18))
    }

    /**
     * Apply newer details without deleting data or replacing filled in data with empty data
     */
    merge(other: MemberDetails) {
        console.log('merge member details', this, other)
        if (other.firstName.length > 0) {
            this.firstName = other.firstName
        }
        if (other.lastName.length > 0) {
            this.lastName = other.lastName
        }

        if (other.email) {
            this.email = other.email
        }

        if (other.birthDay) {
            this.birthDay = other.birthDay
        }

        if (other.gender !== Gender.Other) {
            // Always copy gender
            this.gender = other.gender
        }

        if (other.address) {
            if (this.address) {
                this.updateAddress(this.address, other.address)
            } else {
                this.address = other.address
            }
        }

        if (other.phone) {
            this.phone = other.phone
        }

        if (other.memberNumber) {
            this.memberNumber = other.memberNumber
        }

        if (other.parents.length > 0) {
            for (const parent of other.parents) {
                // Will override existing parent if possible
                this.addParent(parent)
            }
        }

        if (other.emergencyContacts.length > 0) {
            this.emergencyContacts = other.emergencyContacts
        }

        this.reviewTimes.merge(other.reviewTimes)

        if (other.requiresFinancialSupport && (!this.requiresFinancialSupport || this.requiresFinancialSupport.date < other.requiresFinancialSupport.date)) {
            this.requiresFinancialSupport = other.requiresFinancialSupport
        }

        if (other.dataPermissions && (!this.dataPermissions || this.dataPermissions.date < other.dataPermissions.date)) {
            this.dataPermissions = other.dataPermissions
        }

        // Merge answers
        const newAnswers: Map<string, RecordAnswer> = new Map(this.recordAnswers);
        for (const answer of other.recordAnswers.values()) {
            const existing = newAnswers.get(answer.settings.id)

            if (!existing) {
                newAnswers.set(answer.settings.id, answer)
            } else if (answer.date >= existing.date) {
                newAnswers.set(answer.settings.id, answer)
            } else {
                // keep existing, this one is more up-to-date, don't add the other answer
            }
        }
        this.recordAnswers = newAnswers
    }

    getEmailReplacements() {
        return [
            Replacement.create({
                token: "memberFirstName",
                value: this.firstName
            }),
            Replacement.create({
                token: "memberLastName",
                value: this.lastName
            })
        ]
    }
}
