import { AutoEncoderPatchType, PartialWithoutMethods, PatchableArray, PatchableArrayAutoEncoder } from "@simonbackx/simple-encoding"

import { Address } from "../addresses/Address"
import { StamhoofdFilter } from "../filters/new/StamhoofdFilter"
import { Group } from "../Group"
import { Organization } from "../Organization"
import { Platform } from "../Platform"
import { RegisterCheckout, RegisterItem } from "./checkout/RegisterCheckout"
import { EmergencyContact } from "./EmergencyContact"
import { MemberDetails } from "./MemberDetails"
import { MembersBlob, MemberWithRegistrationsBlob } from "./MemberWithRegistrationsBlob"
import { ObjectWithRecords, PatchAnswers } from "./ObjectWithRecords"
import { Parent } from "./Parent"
import { RecordAnswer } from "./records/RecordAnswer"
import { RecordCategory } from "./records/RecordCategory"
import { RecordSettings } from "./records/RecordSettings"
import { PropertyFilter } from "../filters/PropertyFilter"

export class PlatformFamily {
    members: PlatformMember[] = []
    
    // Checkout is required for the member to know whether certain fields are required to get collected
    checkout = new RegisterCheckout()
    
    platform: Platform
    organizations: Organization[] = []

    constructor(context: {contextOrganization?: Organization|null, platform: Platform}) {
        this.platform = context.platform
        this.organizations =context.contextOrganization ? [context.contextOrganization] : []
    }

    insertOrganization(organization: Organization) {
        if (this.organizations.find(o => o.id === organization.id)) {
            return;
        }
        this.organizations.push(organization)
    }

    getOrganization(id: string) {
        return this.organizations.find(o => o.id === id)
    }

    insertFromBlob(blob: MembersBlob) {
        for (const organization of blob.organizations) {
            this.insertOrganization(organization)
        }

        for (const member of blob.members) {
            const existing = this.members.find(m => m.id === member.id);
            if (existing) {
                existing.member = member
                continue;
            }

            const platformMember = new PlatformMember({
                member,
                family: this
            })
            this.members.push(platformMember)
        }
    }

    static createSingles(blob: MembersBlob, context: {contextOrganization?: Organization|null, platform: Platform}): PlatformMember[] {
        const memberList: PlatformMember[] = []

        for (const member of blob.members) {
            const family = new PlatformFamily(context);

            for (const organization of blob.organizations) {
                // Check if this organization is relevant to this member
                if (member.registrations.find(r => r.organizationId === organization.id)) {
                    family.insertOrganization(organization)
                }
            }

            const platformMember = new PlatformMember({
                member,
                family
            })

            family.members.push(platformMember)
            memberList.push(platformMember)
        }
        return memberList
    }

    insertSingle(member: MemberWithRegistrationsBlob): PlatformMember {
        const platformMember = new PlatformMember({
            member,
            family: this
        })

        this.members.push(platformMember)
        return platformMember
    }

    /**
     * These clones are for patches so they only become visible after saving
     */
    clone() {
        const family = new PlatformFamily({
            platform: this.platform
        })
        family.organizations = this.organizations;
        family.checkout = this.checkout;
        family.members = this.members.map(m => m._cloneWithFamily(family))
        return family
    }

    copyFromClone(clone: PlatformFamily) {
        for (const member of this.members) {
            const cloneMember = clone.members.find(m => m.id === member.id)
            if (cloneMember) {
                member.member.set(cloneMember.member)
            }
        }

        for (const c of clone.members) {
            const member = this.members.find(m => m.id === c.id)
            if (!member) {
                this.members.push(c)
            }
        }
    }

    getAddressOccurrences(address: Address, skip?: {memberId?: string, parentId?: string}): string[] {
        const occurrences = new Set<string>()

        const searchString = address.toString()

        for (const member of this.members) {
            if (member.patchedMember.details.address) {
                if (!skip?.memberId || member.id !== skip?.memberId) {
                    if (member.patchedMember.details.address.toString() === searchString) {
                        occurrences.add(member.patchedMember.details.name)
                    }
                }
            }

            for (const parent of member.patchedMember.details.parents) {
                if (parent.address) {
                    if (!skip?.parentId || parent.id !== skip?.parentId) {
                        if (parent.address.toString() === searchString) {
                            occurrences.add(parent.name)
                        }
                    }
                }
            }
        }

        return Array.from(occurrences.values())
    }

    get addresses() {
        const addresses = new Map<string, Address>()
        for (const member of this.members) {
            if (member.member.details.address) {
                addresses.set(member.member.details.address.toString(), member.member.details.address)
            }

            if (member.patchedMember.details.address) {
                addresses.set(member.patchedMember.details.address.toString(), member.patchedMember.details.address)
            }

            for (const parent of member.member.details.parents) {
                if (parent.address) {
                    addresses.set(parent.address.toString(), parent.address)
                }
            }
            
            for (const parent of member.patchedMember.details.parents) {
                if (parent.address) {
                    addresses.set(parent.address.toString(), parent.address)
                }
            }
        }

        return Array.from(addresses.values())
    }

    updateAddress(oldValue: Address, newValue: Address) {
        for (const member of this.members) {
            const patch = member.patchedMember.details.updateAddressPatch(oldValue, newValue)
            if (patch !== null) {
                member.addDetailsPatch(patch)
            }
        }
    }

    /// Update all references to this parent (with same id)
    updateParent(parent: Parent) {
        for (const member of this.members) {
            const patch = member.patchedMember.details.updateParentPatch(parent)
            if (patch !== null) {
                member.addDetailsPatch(patch)
            }
        }
    }

    updateEmergencyContact(emergencyContact: EmergencyContact) {
        for (const member of this.members) {
            const patch = member.patchedMember.details.updateEmergencyContactPatch(emergencyContact)
            if (patch !== null) {
                member.addDetailsPatch(patch)
            }
        }
    }
}

export class PlatformMember implements ObjectWithRecords {
    member: MemberWithRegistrationsBlob
    patch: AutoEncoderPatchType<MemberWithRegistrationsBlob>

    // Save status data:
    _savingPatch: AutoEncoderPatchType<MemberWithRegistrationsBlob>|null = null
    _isCreating: boolean|null = null

    family: PlatformFamily
    isNew = false

    get id() {
        return this.member.id
    }

    constructor(data: {
        member: MemberWithRegistrationsBlob, 
        family: PlatformFamily,
        isNew?: boolean
    }) {
        this.member = data.member
        this.patch = MemberWithRegistrationsBlob.patch({id: this.member.id})
        this.family = data.family
        this.isNew = data.isNew ?? false
    }

    clone() {
        const family = this.family.clone()
        return family.members.find(m => m.id === this.id)!
    }

    _cloneWithFamily(family: PlatformFamily) {
        return new PlatformMember({
            member: this.patchedMember.clone(),
            family,
            isNew: this.isNew
        })
    }

    get organizations() {
        return this.family.organizations
    }

    get platform() {
        return this.family.platform
    }

    get allGroups() {
        return this.organizations.flatMap(o => o.groups)
    }

    get isSaving() {
        return this._savingPatch !== null || this._isCreating !== null
    }

    addPatch(p: PartialWithoutMethods<AutoEncoderPatchType<MemberWithRegistrationsBlob>>) {
        this.patch = this.patch.patch(MemberWithRegistrationsBlob.patch(p))
    }

    addEmergencyContact(emergencyContact: EmergencyContact) {
        const arr = new PatchableArray() as PatchableArrayAutoEncoder<EmergencyContact>
        arr.addPut(emergencyContact);
        this.addDetailsPatch({
            emergencyContacts: arr
        })
    }

    addParent(parent: Parent) {
        const arr = new PatchableArray() as PatchableArrayAutoEncoder<Parent>
        arr.addPut(parent);
        this.addDetailsPatch({
            parents: arr
        })
    }

    addDetailsPatch(p: PartialWithoutMethods<AutoEncoderPatchType<MemberDetails>>) {
        this.addPatch({
            details: MemberDetails.patch(p)
        })
    }

    isPropertyEnabledForPlatform(property: 'birthDay'|'gender'|'address'|'parents'|'emailAddress'|'phone'|'emergencyContacts') {
        const def = this.platform.config.recordsConfiguration[property];
        if (def === null) {
            return false;
        }
        return def.isEnabled(this)
    }

    isPropertyEnabled(property: 'birthDay'|'gender'|'address'|'parents'|'emailAddress'|'phone'|'emergencyContacts') {
        if (this.isPropertyEnabledForPlatform(property)) {
            return true;
        }

        const organizations = this.filterOrganizations({cycleOffset: 0})

        for (const organization of organizations) {
            const def = organization.meta.recordsConfiguration[property];
            if (def === null) {
                continue;
            }
            if (def.enabledWhen === null) {
                return true;
            }
            if (this.doesMatchFilter(def.enabledWhen)) {
                return true;
            }
        }
        return false;
    }

    isPropertyRequiredForPlatform(property: 'birthDay'|'gender'|'address'|'parents'|'emailAddress'|'phone'|'emergencyContacts') {
        const def = this.platform.config.recordsConfiguration[property];
        if (def === null) {
            return false;
        }
        return def.isRequired(this)
    }

    isPropertyRequired(property: 'birthDay'|'gender'|'address'|'parents'|'emailAddress'|'phone'|'emergencyContacts') {
        if (this.isPropertyRequiredForPlatform(property)) {
            return true;
        }

        const organizations = this.filterOrganizations({cycleOffset: 0})

        for (const organization of organizations) {
            const def = organization.meta.recordsConfiguration[property];
            if (def === null) {
                continue;
            }
            if (def.isRequired(this)) {
                return true;
            }
        }
        return false;
    }

    prepareSave() {
        this._savingPatch = this.patch
        this.patch = MemberWithRegistrationsBlob.patch({id: this.member.id})

        this._isCreating = this.isNew
        this.isNew = false
    }

    markSaved() {
        if (this._isCreating === true) {
            this.isNew = false;
        }
        this._savingPatch = null
        this._isCreating = null
    }

    markFailedSave() {
        if (this._savingPatch) {
            this.patch = this._savingPatch.patch(this.patch)
            this._savingPatch = null
        }
        if (this._isCreating !== null) {
            this.isNew = this._isCreating
            this._isCreating = null
        }
    }

    filterRegistrations(filters: {groups?: Group[] | null, waitingList?: boolean, cycleOffset?: number, cycle?: number, canRegister?: boolean}) {
        return this.patchedMember.registrations.filter(r => {
            if (filters.groups && !filters.groups.find(g => g.id === r.groupId)) {
                return false
            }

            let cycle = filters.cycle
            if (filters.cycle === undefined) {
                const group = (filters.groups ?? this.allGroups).find(g => g.id === r.groupId)
                if (group) {
                    cycle = group.cycle - (filters.cycleOffset ?? 0)
                }
            }

            if (
                cycle !== undefined 
                && (filters.waitingList === undefined || r.waitingList === filters.waitingList) 
                && r.cycle === cycle
            ) {
                if (filters.canRegister !== undefined && r.waitingList) {
                    return r.canRegister === filters.canRegister
                }
                return true;
            }
            return false;
        })
    }

    filterGroups(filters: {groups?: Group[] | null, waitingList?: boolean, cycleOffset?: number, cycle?: number, canRegister?: boolean}) {
        const registrations =  this.filterRegistrations(filters);
        const base: Group[] = [];

        for (const registration of registrations) {
            if (base.find(g => g.id === registration.groupId)) {
                continue;
            }

            const organization = this.organizations.find(o => o.id === registration.organizationId);
            if (organization) {
                const group = organization.groups.find(g => g.id === registration.groupId);
                if (group) {
                    base.push(group)
                }
            }
        }

        // Loop checkout
        for (const item of this.family.checkout.cart.items) {
            if (item.member.id === this.id) {
                if (filters.waitingList !== undefined && filters.waitingList !== item.waitingList) {
                    continue
                }

                if (filters.cycle !== undefined && item.group.cycle !== filters.cycle) {
                    continue
                }

                if (filters.cycleOffset !== undefined && filters.cycleOffset !== 0) {
                    continue
                }

                if (filters.canRegister !== undefined && item.waitingList) {
                    continue
                }

                if (!base.find(g => g.id === item.group.id)) {
                    base.push(item.group)
                }
            }
        }

        return base;
    }

    filterOrganizations(filters: {groups?: Group[] | null, waitingList?: boolean, cycleOffset?: number, cycle?: number, canRegister?: boolean}) {
        const registrations =  this.filterRegistrations(filters);
        const base: Organization[] = [];

        for (const registration of registrations) {
            if (base.find(g => g.id === registration.organizationId)) {
                continue;
            }

            const organization = this.organizations.find(o => o.id === registration.organizationId);
            if (organization) {
                base.push(organization)
            }
        }

        // Loop checkout
        for (const item of this.family.checkout.cart.items) {
            if (item.member.id === this.id) {
                if (filters.waitingList !== undefined && filters.waitingList !== item.waitingList) {
                    continue
                }

                if (filters.cycle !== undefined && item.group.cycle !== filters.cycle) {
                    continue
                }

                if (filters.cycleOffset !== undefined && filters.cycleOffset !== 0) {
                    continue
                }

                if (filters.canRegister !== undefined && item.waitingList) {
                    continue
                }

                if (!base.find(g => g.id === item.organization.id)) {
                    base.push(item.organization)
                }
            }
        }

        return base;
    }

    get groups() {
        return this.filterGroups({waitingList: false, cycleOffset: 0});
    }

    insertOrganization(organization: Organization) {
        this.family.insertOrganization(organization)
    }

    canRegister(group: Group) {
        const item = RegisterItem.defaultFor(this, group);
        const error = item.validationError;
        if (error === null) {
            return true;
        }
        return false;
    }

    get patchedMember() {
        if (this._savingPatch) {
            return this.member.patch(this._savingPatch).patch(this.patch)
        }
        return this.member.patch(this.patch)
    }

    doesMatchFilter(filter: StamhoofdFilter)  {
        return this.patchedMember.doesMatchFilter(filter);
    }

    getAllRecordCategories(): RecordCategory[] {
        // From organization
        const categories: RecordCategory[] = [];
        for (const organization of this.organizations) {
            categories.push(...organization.meta.recordsConfiguration.recordCategories)
        }

        categories.push(...this.platform.config.recordsConfiguration.recordCategories)
        return categories;
    }

    getEnabledRecordCategories(): RecordCategory[] {
        // From organization
        const categories: RecordCategory[] = [];
        const inheritedFilters = new Map<string, PropertyFilter[]>()

        for (const organization of this.organizations) {
            categories.push(...organization.meta.recordsConfiguration.recordCategories.filter(r => r.defaultEnabled && r.isEnabled(this)))

            // Any optional categories from the platform that have been enabled?
            for (const [id, filter] of organization.meta.recordsConfiguration.inheritedRecordCategories) {
                inheritedFilters.set(id, [...(inheritedFilters.get(id) ?? []), filter])
            }
        }

        // All required categories of the platform
        for (const category of this.platform.config.recordsConfiguration.recordCategories) {
            if (category.defaultEnabled && category.isEnabled(this)) {
                categories.push(category)
            } else {
                const filters = inheritedFilters.get(category.id)
                if (filters) {
                    if (filters.find(f => f.isEnabled(this))) {
                        categories.push(category)
                    }
                }
            }
        }

        return categories;
    }

    isExistingMember(organizationId: string): boolean {
        const member = this.member;
        if (member.registrations.length === 0) {
            return false
        }
    
        const organization = this.organizations.find(o => o.id === organizationId)
        if (!organization) {
            return false;
        }

        const groups = organization.groups;

        // Check if no year was skipped
        for (const registration of member.registrations) {
            const group = groups.find(g => g.id === registration.groupId)
            if (group === undefined) {
                // Archived or deleted. Use the registeredAt date (should be in the last 1.5 years)
                if (registration.registeredAt !== null && registration.deactivatedAt === null && registration.waitingList === false && registration.registeredAt > new Date(new Date().getTime() - 1000 * 60 * 60 * 24 * 365 * 1.5)) {
                    return true
                }
                continue;
            }
            if (!registration.waitingList && registration.registeredAt !== null && registration.deactivatedAt === null && group && registration.cycle === group.cycle - 1) {
                // This was the previous year
                return true
            }
        }
    
        return false
    }

    isRecordEnabled(record: RecordSettings): boolean {
        if (record.sensitive && !this.patchedMember.details.dataPermissions?.value) {
            return false;
        }
        return true;
    }

    getRecordAnswers(): Map<string, RecordAnswer> {
        return this.patchedMember.details.recordAnswers
    }
}
