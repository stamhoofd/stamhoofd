import { ArrayDecoder,AutoEncoder, BooleanDecoder,DateDecoder,EnumDecoder,field, IntegerDecoder,StringDecoder } from '@simonbackx/simple-encoding';
import { Formatter, StringCompare } from '@stamhoofd/utility';

import { Address } from '../addresses/Address';
import { Group } from '../Group';
import { GroupGenderType } from '../GroupGenderType';
import { EmergencyContact } from './EmergencyContact';
import { Gender } from './Gender';
import { Parent } from './Parent';
import { OldRecord, Record } from './Record';
import { OldRecordType, RecordType } from './RecordType';

// Everything in this file is stored encrypted

export class MemberExistingStatus extends AutoEncoder {
    /**
     * Whether this member is new or not
     */
    @field({ decoder: BooleanDecoder })
    isNew: boolean

    /**
     * Whether this member has an existing brother/sister that was registered in the past year
     */
    @field({ decoder: BooleanDecoder })
    hasFamily: boolean

    @field({ decoder: DateDecoder })
    lastChanged: Date = new Date()

    isExpired() {
        return this.lastChanged <= new Date(new Date().getTime() - 60 * 1000 * 60 * 24 * 14)
    }
}

export class PreferredGroup extends AutoEncoder {
    @field({ decoder: StringDecoder })
    groupId: string

    /**
     * Cycle used, in order to invalidate old values
     */
    @field({ decoder: IntegerDecoder })
    cycle: number

    @field({ decoder: BooleanDecoder })
    waitingList = false
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

    @field({ decoder: new ArrayDecoder(OldRecord) })
    @field({ 
        decoder: new ArrayDecoder(Record), version: 54, upgrade: (old: OldRecord[]): Record[] => {
            const addIfNotFound = new Map<RecordType, boolean>()
            addIfNotFound.set(RecordType.DataPermissions, true)
            addIfNotFound.set(RecordType.PicturePermissions, true)
            addIfNotFound.set(RecordType.GroupPicturePermissions, false)
            addIfNotFound.set(RecordType.MedicinePermissions, true)
            
            const result = old.flatMap((o) => {
                // Does this type exist in RecordType?
                if (Object.values(RecordType).includes(o.type as any)) {
                    return [Record.create(o as any)] // compatible
                }

                if (o.type === OldRecordType.NoPictures) {
                    // Do not add picture permissions
                    addIfNotFound.set(RecordType.PicturePermissions, false)
                }
                if (o.type === OldRecordType.OnlyGroupPictures) {
                    // Yay
                    addIfNotFound.set(RecordType.PicturePermissions, false)
                    addIfNotFound.set(RecordType.GroupPicturePermissions, true)
                }
                if (o.type === OldRecordType.NoData) {
                    // Yay
                    addIfNotFound.set(RecordType.DataPermissions, false)
                }
                if (o.type === OldRecordType.NoPermissionForMedicines) {
                    // Yay
                    addIfNotFound.set(RecordType.MedicinePermissions, false)
                }
                return []
            })

            for (const [key, add] of addIfNotFound.entries()) {
                if (add) {
                    result.push(Record.create({
                        type: key
                    }))
                }
            }

            return result
        } 
    })
    records: Record[] = [];

    @field({ decoder: EmergencyContact, nullable: true })
    doctor: EmergencyContact | null = null;

    /**
     * Last time the records were reviewed
     */
    @field({ decoder: DateDecoder, nullable: true, version: 20 })
    lastReviewed: Date | null = null;

    /**
     * @deprecated
     * Contains the group that was selected during member creation or editing. Used to determine the group to register the member in.
     * This can get cleared after registration, but is not needed since we keep track of the group cycle.
     */
    @field({ decoder: StringDecoder, version: 4, nullable: true, upgrade: () => null, field: "preferredGroupId" })
    @field({ decoder: new ArrayDecoder(PreferredGroup), version: 17, upgrade: (preferredGroupId: string | null) => {
        if (preferredGroupId === null) {
            return []
        }
        return [
            PreferredGroup.create({
                groupId: preferredGroupId,
                cycle: 0,
                waitingList: false
            })
        ]
    } })
    preferredGroups: PreferredGroup[] = []

    /**
     * @deprecated
     * During registration, we sometimes need to know if it is an existing member, new member or a broter/sister of an existing member.
     * We don't ask this information if it is not needed or when we can calculate it automatically based on the member history 
     * (this behaviour is determined by the shouldKnowExisting method of Group)
     * We also keep the date that this was asked, in order to invalidate the response in the future.
     */
    @field({ decoder: MemberExistingStatus, nullable: true, version: 18 })
    existingStatus: MemberExistingStatus | null = null

    /**
     * Keep track whether this are recovered member details. Only set this back to false when:
     * - The data is entered manually again (by member / parents)
     * - Warning message is dismissed / removed in the dashboard by organization
     */
    @field({ decoder: BooleanDecoder, version: 69 })
    isRecovered = false

    /**
     * @deprecated
     */
    get isPlaceholder() {
        return this.isRecovered
    }

    /**
     * @deprecated
     */
    setPlaceholder() {
        this.isRecovered = true
    }

    /**
     * Call this to clean up capitals in all the available data
     */
    cleanData() {
        if (StringCompare.isFullCaps(this.firstName)) {
            this.firstName = Formatter.capitalizeWords(this.firstName.toLowerCase())
        }
        if (StringCompare.isFullCaps(this.lastName)) {
            this.lastName = Formatter.capitalizeWords(this.lastName.toLowerCase())
        }

        this.firstName = Formatter.capitalizeFirstLetter(this.firstName.trim())
        this.lastName = this.lastName.trim()

        for (const parent of this.parents) {
            parent.cleanData()
        }

        this.address?.cleanData()

        for (const contact of this.emergencyContacts) {
            contact.cleanData()
        }
    }

    get name() {
        return this.firstName + " " + this.lastName;
    }

    /// The age this member will become, this year
    ageForYear(year: number): number | null {
        if (!this.birthDay) {
            return null
        }
        return year - this.birthDay.getFullYear();
    }

    get age(): number | null {
        if (!this.birthDay) {
            return null
        }

        const today = new Date();
        let age = today.getFullYear() - this.birthDay.getFullYear();
        const m = today.getMonth() - this.birthDay.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < this.birthDay.getDate())) {
            age--;
        }
        return age;
    }

    get birthDayFormatted(): string | null {
        if (!this.birthDay) {
            return null
        }

        const date = new Date(this.birthDay);
        const options = { year: "numeric", month: "long", day: "numeric" };
        return date.toLocaleDateString("nl-BE", options);
    }

    matchQuery(query: string): boolean {
        const lowerQuery = query.toLowerCase();
        if (
            this.firstName.toLowerCase().includes(lowerQuery) ||
            this.lastName.toLowerCase().includes(lowerQuery) ||
            this.name.toLowerCase().includes(lowerQuery)
        ) {
            return true;
        }
        return false;
    }

    /**
     * Check if this member could fit a group, ignoring dates and waiting lists
     */
    doesMatchGroup(group: Group) {
        if (group.settings.minAge || group.settings.maxAge) {
            const age = this.ageForYear(group.settings.startDate.getFullYear())

            if (age) {
                if (group.settings.minAge && age < group.settings.minAge) {
                    return false
                }

                if (group.settings.maxAge && age > group.settings.maxAge) {
                    return false
                }
            }
        }

        if (this.gender == Gender.Male && group.settings.genderType == GroupGenderType.OnlyFemale) {
            return false
        }

        if (this.gender == Gender.Female && group.settings.genderType == GroupGenderType.OnlyMale) {
            return false
        }
        
        return true
    }

    getMatchingError(group: Group): string {
        const age = this.ageForYear(group.settings.startDate.getFullYear())
        if (group.settings.minAge || group.settings.maxAge) {
            if (age) {
                if (group.settings.minAge && age < group.settings.minAge) {
                    return "Te jong"
                }

                if (group.settings.maxAge && age > group.settings.maxAge) {
                    return "Te oud"
                }
            }
        }

        if (this.gender == Gender.Male && group.settings.genderType == GroupGenderType.OnlyFemale) {
            if (age && age < 18) {
                return "Enkel voor meisjes"
            }
            return "Enkel voor vrouwen"
        }

        if (this.gender == Gender.Female && group.settings.genderType == GroupGenderType.OnlyMale) {
            if (age && age < 18) {
                return "Enkel voor jongens"
            }
            return "Enkel voor mannen"
        }
        
        return "Kan niet inschrijven"
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

    /**
     * This will SET the parent
     */
    updateParent(parent: Parent) {
        for (const [index, _parent] of this.parents.entries()) {
            if (_parent.id == parent.id) {
                this.parents[index] = parent
            }
        }
    }

    /**
     * This will add or update the parent (possibily partially if not all data is present)
     */
    addParent(parent: Parent) {
        for (const [index, _parent] of this.parents.entries()) {
            if (_parent.id == parent.id) {
                this.parents[index].merge(parent)
                return
            }
            if (StringCompare.typoCount(_parent.name, parent.name) < 2) {
                this.parents[index].merge(parent)
                return
            }
        }
        this.parents.push(parent)
    }

    /**
     * Return all the e-mail addresses that should have access to this user
     */
    getManagerEmails(): string[] {
        const emails: string[] = []
        if (this.email) {
            emails.push(this.email)
        }

        if (this.age && (this.age < 18 || (this.age < 24 && !this.address))) {
            for (const parent of this.parents) {
                if (parent.email) {
                    emails.push(parent.email)
                }
            }
        }
        return emails
    }

    /**
     * Apply newer details without deleting data or replacing filled in data with empty data
     */
    merge(other: MemberDetails) {
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

        if (other.lastReviewed) {
            if (this.lastReviewed && this.lastReviewed > other.lastReviewed) {
                // keep current one
            } else {
                this.lastReviewed = other.lastReviewed
            }
        }
    }
}