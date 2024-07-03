import { ArrayDecoder, AutoEncoder, AutoEncoderPatchType, BooleanDecoder, DateDecoder, EnumDecoder, field, MapDecoder, PatchableArray, PatchableArrayAutoEncoder, StringDecoder } from '@simonbackx/simple-encoding';
import { Formatter, StringCompare } from '@stamhoofd/utility';
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
import {MergeHelper, OnlyWritabelKeys} from '@stamhoofd/utility';

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

        this.address?.cleanData()

        for (const contact of this.emergencyContacts) {
            contact.cleanData()
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

    findParentMatch(parent: Parent): Parent | null {
        const findMatch = (isMatch: (p1: Parent, p2: Parent) => boolean | string, property?: string) => {
            for (const [index, _parent] of this.parents.entries()) {
                const result = isMatch(_parent, parent);
                if (result) {
                    if(property) {
                        console.log(`Found parent match on ${property}.`);
                    } else if (typeof result === 'string') {
                        console.log(`Found parent match on ${result}.`);
                    } else {
                        console.log('Found parent match.');
                    }

                    return this.parents[index];
                }
            }
        };

         // Multiple loops to mangage priority
        let match = findMatch((p1, p2) => p1.id == p2.id, 'id');
        if(match) return match;

        // clean data
        parent.cleanData();
        for(const parent of this.parents) {
            parent.cleanData();
        }

        match = findMatch((p1, p2) => !!(p1.name && p2.name && (StringCompare.typoCount(p1.name, p2.name) === 0)), 'name');
        if(match) return match;


        match = findMatch((p1, p2) => !!(p1.name && p2.name && (StringCompare.typoCount(p1.name, p2.name) < 2)), 'name typo');
        if(match) return match;

        match = findMatch((p1, p2) => {
            if (!p1.name || !p2.name) {
                if (p1.email && p2.email) {
                    // Compare on email address
                    if (p1.email == p2.email) {
                        return 'email';
                    }
                }
                if (p1.phone && p2.phone) {
                    if (p1.phone == p2.phone) {
                        return 'phone';
                    }
                }
            }
            return false;
        });
        if(match) return match;
        return null;
    }

    /**
     * This will add or update the parent (possibily partially if not all data is present)
     */
    addParent(parent: Parent) {
        console.log('adding parent to ', this.name)

        const match = this.findParentMatch(parent);

        if(match) {
            match.merge(parent);
            return;
        }

        this.parents.push(parent);
    }

    get parentsHaveAccess() {
        return (this.age && (this.age < 18 || (this.age < 24 && !this.address)))
    }

    /**
     * Return all the e-mail addresses that should have access to this user
     */
    getManagerEmails(): string[] {
        const emails = new Set<string>()
        if (this.email) {
            emails.add(this.email)
        }

        if (this.parentsHaveAccess) {
            for (const parent of this.parents) {
                if (parent.email) {
                    emails.add(parent.email)
                }
            }
        }
        return [...emails]
    }

    /**
     * Return all the e-mail addresses that should have access to this user
     */
    getAllEmails(): string[] {
        const emails = new Set<string>()
        if (this.email) {
            emails.add(this.email)
        }

        for (const parent of this.parents) {
            if (parent.email) {
                emails.add(parent.email)
            }
        }
        return [...emails]
    }


    /**
     * Apply newer details without deleting data or replacing filled in data with empty data
     */
    mergeChanges(other: MemberDetails) {
        console.log('merge member details', this, other)
        const changes: Partial<OnlyWritabelKeys<MemberDetails>> = {};
        const parentChanges = new Map<string, Partial<OnlyWritabelKeys<Parent>>>();
        const newParents: Parent[] = [];


        const merge = (key: keyof OnlyWritabelKeys<MemberDetails>, checkEmpty = false) => MergeHelper.mergeChange(this, other, changes, key, checkEmpty);
        const forceMerge = (key: keyof OnlyWritabelKeys<MemberDetails>) => MergeHelper.forceChange(this, other, changes, key);

        const requiredDetails: (keyof OnlyWritabelKeys<MemberDetails>)[] = ['firstName', 'lastName'];

        requiredDetails.forEach(detail => merge(detail, true));

        const compulsoryDetails: (keyof OnlyWritabelKeys<MemberDetails>)[] = ['email', 'birthDay', 'phone', 'memberNumber'];

        compulsoryDetails.forEach((detail) => merge(detail));

        if (other.gender !== Gender.Other) {
            // Always copy gender
            forceMerge('gender');
        }

        const mergeParentChange = <P extends keyof OnlyWritabelKeys<Parent>>(parent: Parent, property: P, newValue: Parent[P]) => {
            const id = parent.id;
            const parentValue = parent[property];

            if(newValue !== parentValue) {
                parent[property] = newValue;

                if(parentChanges.has(id)) {
                    const changes = parentChanges.get(id);
                    changes![property] = newValue;
                } else {
                    parentChanges.set(id, {[property]: newValue});
                }
            }
        }

        const mergeAddress = () => {
            const thisAddress = this.address;
            const otherAddress = other.address;
            if(otherAddress) {
                if(thisAddress) {
                    const currentAddressString = thisAddress.toString();
                    if(currentAddressString !== otherAddress.toString()) {
                        forceMerge('address');
                    }

                    this.parents.filter(p => p.address && p.address.toString() === currentAddressString).forEach(parent => {
                        mergeParentChange(parent, 'address', otherAddress);
                    });
                } else {
                    forceMerge('address')
                }
            }
        }

        mergeAddress();

        if (other.parents.length > 0) {
            for (const parent of other.parents) {
                // Will override existing parent if possible
                const match = this.findParentMatch(parent);
                if(match) {
                    // todo: create parent changes?
                } else {
                    this.parents.push(parent);
                    newParents.push(parent);
                }
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
