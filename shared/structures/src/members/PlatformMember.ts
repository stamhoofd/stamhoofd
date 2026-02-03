import { AutoEncoderPatchType, deepSetArray, PartialWithoutMethods, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';

import { AccessRight } from '../AccessRight.js';
import { type Group } from '../Group.js';
import { GroupType } from '../GroupType.js';

import { Organization } from '../Organization.js';
import { PermissionLevel } from '../PermissionLevel.js';
import { PermissionsResourceType } from '../PermissionsResourceType.js';

import { Document as DocumentStruct } from '../Document.js';
import { Platform } from '../Platform.js';
import { UserWithMembers } from '../UserWithMembers.js';
import { Address } from '../addresses/Address.js';
import { type PropertyFilter } from '../filters/PropertyFilter.js';
import { StamhoofdFilter } from '../filters/StamhoofdFilter.js';
import { getActivePeriodIds } from '../getActivePeriods.js';
import { MemberPlatformMembershipHelper } from '../helpers/MemberPlatformMembershipHelper.js';
import { EmergencyContact } from './EmergencyContact.js';
import { Member } from './Member.js';
import { MemberDetails, MemberProperty } from './MemberDetails.js';
import { MembersBlob, MemberWithRegistrationsBlob } from './MemberWithRegistrationsBlob.js';
import { type ContinuousMembershipStatus } from './MembershipStatus.js';
import { NationalRegisterNumberOptOut } from './NationalRegisterNumberOptOut.js';
import { ObjectWithRecords, PatchAnswers } from './ObjectWithRecords.js';
import { OrganizationRecordsConfiguration } from './OrganizationRecordsConfiguration.js';
import { Parent } from './Parent.js';
import { Registration } from './Registration.js';
import { RegistrationsBlob } from './RegistrationsBlob.js';
import { RegisterCheckout } from './checkout/RegisterCheckout.js';
import { RegisterItem } from './checkout/RegisterItem.js';
import { RecordAnswer } from './records/RecordAnswer.js';
import { RecordCategory } from './records/RecordCategory.js';
import { RecordSettings } from './records/RecordSettings.js';

export class PlatformFamily {
    members: PlatformMember[] = [];
    documents: DocumentStruct[] = [];

    /**
     * Checkout is required for the member to know whether certain fields are required to get collected
     */
    checkout = new RegisterCheckout();

    /**
     * Items that have not been added to the cart/checkout, but will be - and for which data has to be collected
     */
    pendingRegisterItems: RegisterItem[] = [];

    platform: Platform;
    organizations: Organization[] = [];

    /**
     * Helper data point, to know whether we already tried loading the full family for this member.
     *
     * By default it is false, which is okay most of the times. Set it to true when you know you didn't really load the full family and there is a chance
     * there are unknown members in the family.
     */
    _isSingle = false;

    constructor(context: { contextOrganization?: Organization | null; platform: Platform }) {
        this.platform = context.platform;
        this.organizations = context.contextOrganization ? [context.contextOrganization] : [];
    }

    /**
     * returns the uuid of the oldest member
     */
    get uuid() {
        if (this.members.length === 0) {
            return '';
        }

        // Sort by createdAt, so the oldest member is first
        const sorted = this.members.sort((a, b) => a.member.createdAt.getTime() - b.member.createdAt.getTime());
        return sorted[0].id;
    }

    insertOrganization(organization: Organization) {
        const existing = this.organizations.find(o => o.id === organization.id);
        if (existing) {
            // Deep set, because this might be the context organization
            if (existing !== organization) {
                existing.deepSet(organization);
            }
            return;
        }
        this.organizations.push(organization);
    }

    getOrganization(id: string) {
        const b = this.organizations.find(o => o.id === id);
        if (b) {
            return b;
        }
        // Check in checkout cart
        if (this.checkout.singleOrganization?.id === id) {
            return this.checkout.singleOrganization;
        }
        const q = this.pendingRegisterItems.find(i => i.organization.id === id);
        if (q) {
            return q.organization;
        }
    }

    static create(blob: MembersBlob, context: { contextOrganization?: Organization | null; platform: Platform }): PlatformFamily {
        const family = new PlatformFamily(context);
        family.insertFromBlob(blob);
        return family;
    }

    insertFromBlob(blob: MembersBlob, removeMissing = false) {
        for (const organization of blob.organizations) {
            this.insertOrganization(organization);
        }

        for (const member of blob.members) {
            const existing = this.members.find(m => m.id === member.id);
            if (existing) {
                existing.member.deepSet(member);
                continue;
            }

            const platformMember = new PlatformMember({
                member,
                family: this,
            });
            this.members.push(platformMember);
        }

        if (removeMissing) {
            // Keep same array reference
            deepSetArray(this.members, this.members.filter(m => blob.members.find(b => b.id === m.id)));
        }
    }

    /**
     * Update multiple members if you don't have a family reference (or multiple families)
     */
    static updateFromBlob(members: PlatformMember[], blob: MembersBlob) {
        const passedFamilies = new Set<PlatformFamily>();
        for (const member of members) {
            if (passedFamilies.has(member.family)) {
                continue;
            }
            member.family.updateFromBlob(blob);
            passedFamilies.add(member.family);
        }
    }

    /**
     * Same as insertFromBlob, but doesn't add new members, only updates existing members
     */
    updateFromBlob(blob: MembersBlob) {
        for (const organization of blob.organizations) {
            this.insertOrganization(organization);
        }

        for (const member of blob.members) {
            const existing = this.members.find(m => m.id === member.id);
            if (existing) {
                existing.member.deepSet(member);
            }
        }
    }

    newMember(): PlatformMember {
        const member = new PlatformMember({
            member: MemberWithRegistrationsBlob.create({
                details: MemberDetails.create({}),
                users: [],
                registrations: [],
            }),
            family: this,
            isNew: true,
        });
        this.members.push(member);
        return member;
    }

    static createSingles(blob: MembersBlob, context: { contextOrganization?: Organization | null; platform: Platform }): PlatformMember[] {
        const memberList: PlatformMember[] = [];

        for (const member of blob.members) {
            const family = new PlatformFamily(context);
            family._isSingle = true;

            for (const organization of blob.organizations) {
                // Check if this organization is relevant to this member
                if (member.registrations.find(r => r.organizationId === organization.id) || member.platformMemberships.find(m => m.organizationId === organization.id) || member.responsibilities.find(r => r.organizationId === organization.id)) {
                    family.insertOrganization(organization);
                }
            }

            const platformMember = new PlatformMember({
                member,
                family,
            });

            family.members.push(platformMember);
            memberList.push(platformMember);
        }
        return memberList;
    }

    /**
     * These clones are for patches so they only become visible after saving
     */
    clone() {
        const family = new PlatformFamily({
            platform: this.platform,
        });
        family.organizations = this.organizations;
        family.checkout = this.checkout;
        family.pendingRegisterItems = this.pendingRegisterItems;
        family.members = this.members.map(m => m._cloneWithFamily(family));
        return family;
    }

    copyFromClone(clone: PlatformFamily) {
        for (const member of this.members) {
            const cloneMember = clone.members.find(m => m.id === member.id)
                ?? clone.members.find(m => m.member.details.oldIds.includes(member.id) || member.member.details.oldIds.includes(m.id));

            if (cloneMember) {
                member.member.deepSet(cloneMember.member);
                member.patch.deepSet(cloneMember.patch);
                member.patch.id = member.id;
                member.isNew = cloneMember.isNew;

                if (cloneMember._savingPatch || cloneMember._isCreating) {
                    console.warn('Copying from member that is being saved');
                }
            }
            else {
                console.warn('copyFromClone could not find member with id', member.id, 'in clone.');
            }
        }

        for (const c of clone.members) {
            const member = this.members.find(m => m.id === c.id);
            if (!member) {
                this.members.push(c._cloneWithFamily(this));
            }
        }

        // Delete members that are not in the clone
        this.members = this.members.filter(m => clone.members.find(c => c.id === m.id));

        for (const o of clone.organizations) {
            this.insertOrganization(o);
        }
    }

    getAddressOccurrences(address: Address, skip?: { memberId?: string; parentId?: string }): string[] {
        const occurrences = new Set<string>();

        const searchString = address.toString();

        for (const member of this.members) {
            if (member.patchedMember.details.address) {
                if (!skip?.memberId || member.id !== skip?.memberId) {
                    if (member.patchedMember.details.address.toString() === searchString) {
                        occurrences.add(member.patchedMember.details.name);
                    }
                }
            }

            for (const parent of member.patchedMember.details.parents) {
                if (parent.address) {
                    if (!skip?.parentId || parent.id !== skip?.parentId) {
                        if (parent.address.toString() === searchString) {
                            occurrences.add(parent.name);
                        }
                    }
                }
            }
        }

        return Array.from(occurrences.values());
    }

    getAddressesWithoutPatches(skip: { memberId?: string; parentId?: string }) {
        const addresses = new Map<string, Address>();
        for (const member of this.members) {
            if (member.member.details.address) {
                addresses.set(member.member.details.address.toString(), member.member.details.address);
            }

            if (!skip.memberId || member.id !== skip.memberId) {
                if (member.patchedMember.details.address) {
                    addresses.set(member.patchedMember.details.address.toString(), member.patchedMember.details.address);
                }
            }

            for (const parent of member.member.details.parents) {
                if (parent.address) {
                    addresses.set(parent.address.toString(), parent.address);
                }
            }

            for (const parent of member.patchedMember.details.parents) {
                if (!skip.parentId || parent.id !== skip.parentId) {
                    if (parent.address) {
                        addresses.set(parent.address.toString(), parent.address);
                    }
                }
            }

            for (const unverifiedAddress of member.member.details.unverifiedAddresses) {
                addresses.set(unverifiedAddress.toString(), unverifiedAddress);
            }
        }

        return Array.from(addresses.values());
    }

    get addresses() {
        const addresses = new Map<string, Address>();
        for (const member of this.members) {
            if (member.member.details.address) {
                addresses.set(member.member.details.address.toString(), member.member.details.address);
            }

            if (member.patchedMember.details.address) {
                addresses.set(member.patchedMember.details.address.toString(), member.patchedMember.details.address);
            }

            for (const parent of member.member.details.parents) {
                if (parent.address) {
                    addresses.set(parent.address.toString(), parent.address);
                }
            }

            for (const parent of member.patchedMember.details.parents) {
                if (parent.address) {
                    addresses.set(parent.address.toString(), parent.address);
                }
            }

            for (const unverifiedAddress of member.member.details.unverifiedAddresses) {
                addresses.set(unverifiedAddress.toString(), unverifiedAddress);
            }
        }

        return Array.from(addresses.values());
    }

    get parents() {
        if (!this.members) {
            return [];
        }
        const parents = new Map<string, Parent>();
        for (const member of this.members) {
            for (const parent of member.patchedMember.details.parents) {
                parents.set(parent.id, parent);
            }
        }

        return Array.from(parents.values());
    }

    /**
     * Change all references to an address to a new address
     */
    updateAddress(oldValue: Address, newValue: Address) {
        for (const member of this.members) {
            const patch = member.patchedMember.details.updateAddressPatch(oldValue, newValue);
            if (patch !== null) {
                member.addDetailsPatch(patch);
            }
        }
    }

    /// Update all references to this parent (with same id)
    patchParent(parent: AutoEncoderPatchType<Parent>) {
        for (const member of this.members) {
            if (member.patchedMember.details.parents.find(p => p.id === parent.id)) {
                member.patchParent(parent);
            }
        }
    }

    getMembersForParent(parent: Parent) {
        return this.members.filter(m => m.patchedMember.details.parents.find(p => p.id === parent.id));
    }

    patchEmergencyContact(emergencyContact: AutoEncoderPatchType<EmergencyContact>) {
        for (const member of this.members) {
            if (member.patchedMember.details.emergencyContacts.find(p => p.id === emergencyContact.id)) {
                member.patchEmergencyContact(emergencyContact);
            }
        }
    }

    getRecommendedEventsFilter(): StamhoofdFilter {
        const filter: StamhoofdFilter = [];

        const groups = new Set<string>();
        const defaultGroupIds = new Set<string>();
        const organizationIds = new Set<string>();
        const organizationTags = new Set<string>();
        const ages = new Set<number>();
        const periodIds = getActivePeriodIds(null, null, this.platform);
        for (const org of this.organizations) {
            const ids = getActivePeriodIds(null, org);
            for (const id of ids) {
                periodIds.add(id);
            }
        }
        const periodIdsArray = [...periodIds];

        for (const member of this.members) {
            for (const group of member.filterGroups({ types: [GroupType.Membership], periodIds: periodIdsArray, includePending: true })) {
                groups.add(group.id);
                if (group.defaultAgeGroupId) {
                    defaultGroupIds.add(group.defaultAgeGroupId);
                }
                organizationIds.add(group.organizationId);

                const organization = this.getOrganization(group.organizationId);
                if (organization) {
                    for (const tag of organization.meta.tags) {
                        organizationTags.add(tag);
                    }
                }

                if (member.patchedMember.details.age) {
                    const d = member.patchedMember.details.trackedAgeForYear(new Date().getFullYear());
                    if (d !== null) {
                        ages.add(d);
                    }

                    const d2 = member.patchedMember.details.trackedAgeForYear(new Date(Date.now() + 1000 * 60 * 60 * 24 * 31 * 6).getFullYear());
                    if (d2 !== null) {
                        ages.add(d2);
                    }
                }
            }
        }

        filter.push({
            groupIds: {
                $in: [null, ...groups.values()],
            },
            defaultAgeGroupIds: {
                $in: [null, ...defaultGroupIds.values()],
            },
            organizationId: {
                $in: [null, ...organizationIds.values()],
            },
            organizationTagIds: {
                $in: [null, ...organizationTags.values()],
            },
        });

        if (ages.size) {
            filter.push({
                $or: [...ages].sort().map(age => ({
                    $and: [
                        {
                            $or: [
                                { minAge: { $lte: age } },
                            ],
                        },
                        {
                            $or: [
                                { maxAge: null },
                                { maxAge: { $gte: age } },
                            ],
                        },
                    ],
                })),
            });
        }

        return filter;
    }

    deleteMember(id: string) {
        this.members = this.members.filter(m => m.id !== id);
    }

    setDocuments(documents: DocumentStruct[]) {
        this.documents = documents;
    }

    belongsToFamily(member: MemberWithRegistrationsBlob): boolean {
        const allUserIds = new Set(this.members.flatMap(m => m.member.users.map(u => u.id)));

        for (const user of member.users) {
            if (allUserIds.has(user.id)) {
                return true;
            }
        }

        return false;
    }

    add(platformMember: PlatformMember) {
        const existing = this.members.find(m => m.id === platformMember.id);
        if (!existing) {
            this.members.push(platformMember);
        }

        if (platformMember.family !== this) {
            platformMember.family = this;
        }
    }
}

export class PlatformRegistration extends Registration {
    member: PlatformMember;

    static createSingles(blob: RegistrationsBlob, context: { contextOrganization?: Organization | null; platform: Platform }): PlatformRegistration[] {
        const results: PlatformRegistration[] = [];

        for (const registration of blob.registrations) {
            const family = new PlatformFamily(context);
            const member = registration.member;

            for (const organization of blob.organizations) {
                // Check if this organization is relevant to this member
                if (member.registrations.find(r => r.organizationId === organization.id) || member.platformMemberships.find(m => m.organizationId === organization.id) || member.responsibilities.find(r => r.organizationId === organization.id)) {
                    family.insertOrganization(organization);
                }
            }

            const platformMember = new PlatformMember({
                member,
                family,
            });

            const platformRegistration = PlatformRegistration.create({
                ...registration,
                member: platformMember,
            });

            // todo (double in create)
            platformRegistration.member = platformMember;

            family.members.push(platformMember);
            results.push(platformRegistration);
        }

        return results;
    }
}

export class PlatformMember implements ObjectWithRecords {
    member: MemberWithRegistrationsBlob;
    patch: AutoEncoderPatchType<MemberWithRegistrationsBlob>;

    // Save status data:
    _savingPatch: AutoEncoderPatchType<MemberWithRegistrationsBlob> | null = null;
    _isCreating: boolean | null = null;

    family: PlatformFamily;
    isNew = false;

    /**
     * If you create a member yourself, you automatically get full access granted.
     * The frontend can't calculate this on its own because it is only temporary.
     */
    hasFullAccess = false;

    get id() {
        return this.member.id;
    }

    constructor(data: {
        member: MemberWithRegistrationsBlob;
        family: PlatformFamily;
        isNew?: boolean;
        hasFullAccess?: boolean;
        patch?: AutoEncoderPatchType<MemberWithRegistrationsBlob>;
    }) {
        this.member = data.member;
        this.patch = data.patch ?? MemberWithRegistrationsBlob.patch({ id: this.member.id });
        this.family = data.family;
        this.isNew = data.isNew ?? false;
        this.hasFullAccess = (data.hasFullAccess ?? false) || this.isNew;
    }

    clone() {
        const family = this.family.clone();
        return family.members.find(m => m.id === this.id)!;
    }

    _cloneWithFamily(family: PlatformFamily) {
        const c = new PlatformMember({
            member: this.member.clone(),
            family,
            isNew: this.isNew,
            hasFullAccess: this.hasFullAccess,
            patch: this.patch.clone(),
        });

        return c;
    }

    get organizations() {
        return this.family.organizations;
    }

    get platform() {
        return this.family.platform;
    }

    get allGroups() {
        return this.organizations.flatMap(o => o.groups);
    }

    get isSaving() {
        return this._savingPatch !== null || this._isCreating !== null;
    }

    get filteredMemberships() {
        return this.patchedMember.platformMemberships.filter(t => !!this.organizations.find(o => o.id === t.organizationId));
    }

    get membershipStatus() {
        return MemberPlatformMembershipHelper.getStatus(this.filteredMemberships);
    }

    get hasFutureMembership(): boolean {
        return MemberPlatformMembershipHelper.hasFutureMembership(this.filteredMemberships);
    }

    get shouldApplyReducedPrice() {
        return this.patchedMember.details.shouldApplyReducedPrice;
    }

    getContinuousMembershipStatus({ start, end }: { start: Date; end: Date }): ContinuousMembershipStatus {
        return MemberPlatformMembershipHelper.getContinuousMembershipStatus({
            memberships: this.filteredMemberships,
            start,
            end,
        });
    }

    addPatch(p: PartialWithoutMethods<AutoEncoderPatchType<MemberWithRegistrationsBlob>>) {
        this.patch = this.patch.patch(MemberWithRegistrationsBlob.patch(p));
    }

    addEmergencyContact(emergencyContact: EmergencyContact) {
        const arr = new PatchableArray() as PatchableArrayAutoEncoder<EmergencyContact>;
        arr.addPut(emergencyContact);
        this.addDetailsPatch({
            emergencyContacts: arr,
        });
    }

    patchEmergencyContact(emergencyContact: AutoEncoderPatchType<EmergencyContact>) {
        const arr = new PatchableArray() as PatchableArrayAutoEncoder<EmergencyContact>;
        arr.addPatch(emergencyContact);
        this.addDetailsPatch({
            emergencyContacts: arr,
        });
    }

    addParent(parent: Parent) {
        const arr = new PatchableArray() as PatchableArrayAutoEncoder<Parent>;
        arr.addPut(parent);
        this.addDetailsPatch({
            parents: arr,
        });
    }

    patchParent(parent: AutoEncoderPatchType<Parent>) {
        const arr = new PatchableArray() as PatchableArrayAutoEncoder<Parent>;
        arr.addPatch(parent);
        this.addDetailsPatch({
            parents: arr,
        });
    }

    addDetailsPatch(p: PartialWithoutMethods<AutoEncoderPatchType<MemberDetails>>) {
        this.addPatch({
            details: MemberDetails.patch(p),
        });
    }

    isPropertyEnabledForPlatform(property: MemberProperty) {
        if ((property === 'financialSupport' || property === 'uitpasNumber')
            && this.patchedMember.details.dataPermissions?.value === false) {
            return false;
        }

        if (property === 'dataPermission' || property === 'financialSupport') {
            if (this.platform.config.recordsConfiguration[property]) {
                return true;
            }
            return false;
        }

        if (property === 'parents.nationalRegisterNumber') {
            if (this.patchedMember.details.nationalRegisterNumber === NationalRegisterNumberOptOut) {
                return false;
            }
            property = 'nationalRegisterNumber';
        }

        const def = this.platform.config.recordsConfiguration[property];
        if (def === null) {
            return false;
        }
        return def.isEnabled(this);
    }

    isPropertyEnabled(property: MemberProperty, options?: { checkPermissions?: { user: UserWithMembers; level: PermissionLevel }; scopeGroups?: Group[] | null }) {
        if (property === 'parents.nationalRegisterNumber') {
            if (this.patchedMember.details.nationalRegisterNumber === NationalRegisterNumberOptOut) {
                return false;
            }
            property = 'nationalRegisterNumber';
        }
        if ((property === 'financialSupport' || property === 'uitpasNumber')
            && this.patchedMember.details.dataPermissions?.value === false) {
            return false;
        }

        if (options?.checkPermissions && (property === 'financialSupport' || property === 'uitpasNumber')) {
            const isUserManager = options.checkPermissions.user.members.members.some(m => m.id === this.id);
            if (!isUserManager) {
                // Need permission to view financial support
                let foundPermissions = false;
                for (const organization of this.filterOrganizations({ currentPeriod: options?.scopeGroups ? undefined : true, groups: options?.scopeGroups })) {
                    if (options.checkPermissions.user.permissions?.forOrganization(organization, Platform.shared)?.hasAccessRight(options.checkPermissions.level === PermissionLevel.Read ? AccessRight.MemberReadFinancialData : AccessRight.MemberWriteFinancialData)) {
                        foundPermissions = true;
                        break;
                    }
                }
                if (!foundPermissions) {
                    return false;
                }
            }
        }

        if (options?.checkPermissions && (property === 'nationalRegisterNumber')) {
            const isUserManager = options.checkPermissions.user.members.members.some(m => m.id === this.id);
            if (!isUserManager) {
                // Need permission to view financial support
                let foundPermissions = false;
                for (const organization of this.filterOrganizations({ currentPeriod: options?.scopeGroups ? undefined : true, groups: options?.scopeGroups })) {
                    if (options.checkPermissions.user.permissions?.forOrganization(organization, Platform.shared)?.hasAccessRight(AccessRight.MemberManageNRN)) {
                        foundPermissions = true;
                        break;
                    }
                }
                if (!foundPermissions) {
                    return false;
                }
            }
        }

        if (this.isPropertyEnabledForPlatform(property)) {
            return true;
        }

        const recordsConfigurations = this.filterRecordsConfigurations({
            currentPeriod: options?.scopeGroups ? undefined : true,
            // When asking for what properties are enabled, we also enable properties that were enabled by registrations in the previous period
            // Note that they aren't required
            previousPeriod: options?.scopeGroups ? undefined : true,
            groups: options?.scopeGroups,
        });

        for (const recordsConfiguration of recordsConfigurations) {
            if (property === 'dataPermission' || property === 'financialSupport') {
                if (recordsConfiguration[property]) {
                    return true;
                }
                continue;
            }

            const def = recordsConfiguration[property] as PropertyFilter | null;
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

    isPropertyRequiredForPlatform(property: MemberProperty) {
        if (!this.isPropertyEnabledForPlatform(property)) {
            return false;
        }

        if (property === 'parents.nationalRegisterNumber') {
            if (this.patchedMember.details.nationalRegisterNumber === NationalRegisterNumberOptOut) {
                return false;
            }
            property = 'nationalRegisterNumber';
        }

        const def = this.platform.config.recordsConfiguration[property];

        if (typeof def === 'boolean') {
            return def;
        }

        if (def === null) {
            return false;
        }
        return def.isRequired(this);
    }

    isPropertyRequired(property: MemberProperty, options?: { checkPermissions?: { user: UserWithMembers; level: PermissionLevel }; scopeGroups?: Group[] | null }) {
        if (!this.isPropertyEnabled(property, options)) {
            return false;
        }

        if (property === 'parents.nationalRegisterNumber') {
            property = 'nationalRegisterNumber';
        }

        if (property === 'nationalRegisterNumber' && this.patchedMember.details.nationalRegisterNumber === NationalRegisterNumberOptOut) {
            // Not required for parents or member itself
            return false;
        }

        const recordsConfigurations = this.filterRecordsConfigurations({ currentPeriod: options?.scopeGroups ? undefined : true, groups: options?.scopeGroups });

        for (const recordsConfiguration of recordsConfigurations) {
            const def = recordsConfiguration[property];
            if (typeof def === 'boolean') {
                if (def === true) {
                    return def;
                }
                continue;
            }

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
        this._savingPatch = this.patch;
        this.patch = MemberWithRegistrationsBlob.patch({ id: this.member.id });

        this._isCreating = this.isNew;
        this.isNew = false;
    }

    markSaved() {
        if (this._isCreating === true) {
            this.isNew = false;
        }
        this._savingPatch = null;
        this._isCreating = null;
    }

    markFailedSave() {
        if (this._savingPatch) {
            this.patch = this._savingPatch.patch(this.patch);
            this._savingPatch = null;
        }
        if (this._isCreating !== null) {
            this.isNew = this._isCreating;
            this._isCreating = null;
        }
    }

    /**
     *
     * @param filters
     * @param filters.groups - Only show registrations for these groups
     * @param filters.groupIds - Only show registrations for these group ids
     * @param filters.canRegister - Only show registrations for which the member can register
     * @param filters.periodId - Only show registrations for this period
     * @param filters.periodIds - Only show registrations for these periods
     * @param filters.currentPeriod - Only show registrations for the current period
     * @param filters.previousPeriod - Also who registrations for previous period, can be combined with currentPeriod
     * @param filters.includeFuture - Used in combination with currentPeriod. If true, also show registrations that start in the future. Defaults to true.
     * @param filters.types - Only show registrations for these group types
     * @param filters.organizationId - Only show registrations for this organization
     * @returns
     */
    filterRegistrations(filters: {
        groups?: Group[] | null;
        groupIds?: string[] | null;
        defaultAgeGroupIds?: string[];
        canRegister?: boolean;
        periodId?: string;
        periodIds?: string[];
        includeFuture?: boolean;
        currentPeriod?: boolean;
        previousPeriod?: boolean;
        types?: GroupType[];
        organizationId?: string;
    }) {
        return this.patchedMember.registrations.filter((r) => {
            if (r.registeredAt === null || r.deactivatedAt !== null) {
                return false;
            }

            if (filters.organizationId && r.organizationId !== filters.organizationId) {
                return false;
            }

            if (filters.types !== undefined) {
                if (!filters.types.includes(r.group.type)) {
                    return false;
                }
            }

            if (filters.groups && !filters.groups.find(g => g.id === r.groupId)) {
                return false;
            }

            if (filters.groupIds && !filters.groupIds.includes(r.groupId)) {
                return false;
            }

            if (filters.defaultAgeGroupIds && (!r.group.defaultAgeGroupId || !filters.defaultAgeGroupIds.includes(r.group.defaultAgeGroupId))) {
                return false;
            }

            if (filters.currentPeriod !== undefined) {
                const organization = this.family.getOrganization(r.organizationId);
                const isCurrentPeriod = !!organization && r.group.periodId === organization.period.period.id;

                if (isCurrentPeriod !== filters.currentPeriod) {
                    if (!(filters.includeFuture ?? true) || r.group.settings.endDate < new Date()) {
                        if (filters.previousPeriod) {
                            // Previous period is also fine
                            const isPreviousPeriod = !!organization && r.group.periodId === organization.period.period.previousPeriodId;
                            if (!isPreviousPeriod) {
                                return false;
                            }
                        }
                        else {
                            return false;
                        }
                    }
                }
            }
            else if (filters.previousPeriod) {
                const organization = this.family.getOrganization(r.organizationId);

                // Previous period is also fine
                const isPreviousPeriod = !!organization && r.group.periodId === organization.period.period.previousPeriodId;
                if (!isPreviousPeriod) {
                    return false;
                }
            }

            if (filters.periodId && r.group.periodId !== filters.periodId) {
                return false;
            }

            if (filters.periodIds && !filters.periodIds.includes(r.group.periodId)) {
                return false;
            }

            if (filters.canRegister !== undefined && r.canRegister !== filters.canRegister) {
                return false;
            }

            return true;
        });
    }

    filterGroups(filters: {
        groups?: Group[] | null;
        canRegister?: boolean;
        periodId?: string;
        periodIds?: string[];
        currentPeriod?: boolean;
        previousPeriod?: boolean;
        includeFuture?: boolean;
        includePending?: boolean;
        types?: GroupType[];
        organizationId?: string;
    }) {
        const registrations = this.filterRegistrations(filters);
        const base: Group[] = [];

        for (const registration of registrations) {
            if (base.find(g => g.id === registration.groupId)) {
                continue;
            }

            base.push(registration.group);
        }

        // Loop checkout
        if (filters.includePending) {
            for (const item of [...this.family.checkout.cart.items, ...this.family.pendingRegisterItems]) {
                if (item.member.id === this.id) {
                    if (filters.currentPeriod === false) {
                        continue;
                    }

                    if (filters.periodId && item.group.periodId !== filters.periodId) {
                        continue;
                    }

                    if (filters.periodIds && !filters.periodIds.includes(item.group.periodId)) {
                        continue;
                    }

                    if (filters.canRegister !== undefined) {
                        continue;
                    }

                    if (filters.organizationId !== undefined) {
                        if (item.organization.id !== filters.organizationId) {
                            continue;
                        }
                    }

                    if (!base.find(g => g.id === item.group.id)) {
                        base.push(item.group);
                    }
                }
            }
        }

        return base;
    }

    filterRecordsConfigurations(filters: {
        groups?: Group[] | null;
        canRegister?: boolean;
        periodId?: string;
        currentPeriod?: boolean;
        previousPeriod?: boolean;
        types?: GroupType[];
        organizationId?: string;
    }) {
        const groups = this.filterGroups({ ...filters, includePending: true });
        const configurations: OrganizationRecordsConfiguration[] = [];

        for (const group of groups) {
            const organization = this.family.getOrganization(group.organizationId);
            if (!organization) {
                continue;
            }

            configurations.push(
                OrganizationRecordsConfiguration.build({
                    platform: this.platform,
                    organization,
                    group,
                    includeGroup: true,
                }),
            );
        }

        if (groups.length === 0) {
            configurations.push(
                OrganizationRecordsConfiguration.build({
                    platform: this.platform,
                }),
            );
        }

        return configurations;
    }

    filterOrganizations(filters: {
        groups?: Group[] | null;
        canRegister?: boolean;
        periodId?: string;
        periodIds?: string[];
        withResponsibilities?: boolean;
        currentPeriod?: boolean;
        types?: GroupType[];
    }) {
        const registrations = this.filterRegistrations(filters);
        const base: Organization[] = [];

        for (const registration of registrations) {
            if (base.find(g => g.id === registration.organizationId)) {
                continue;
            }

            const organization = this.family.getOrganization(registration.organizationId);
            if (organization) {
                base.push(organization);
            }
        }

        // Loop checkout
        for (const item of [...this.family.checkout.cart.items, ...this.family.pendingRegisterItems]) {
            if (item.member.id === this.id) {
                if (filters.currentPeriod === false) {
                    continue;
                }

                if (filters.periodId && item.group.periodId !== filters.periodId) {
                    continue;
                }

                if (filters.periodIds && !filters.periodIds.includes(item.group.periodId)) {
                    continue;
                }

                if (filters.canRegister !== undefined) {
                    continue;
                }

                if (filters.types !== undefined) {
                    if (!filters.types.includes(item.group.type)) {
                        continue;
                    }
                }

                if (!base.find(g => g.id === item.organization.id)) {
                    base.push(item.organization);
                }
            }
        }

        // Loop responsibilities
        if (filters.withResponsibilities) {
            for (const responsibility of this.patchedMember.responsibilities) {
                if (!responsibility.isActive) {
                    continue;
                }

                if (!responsibility.organizationId) {
                    continue;
                }

                if (base.find(g => g.id === responsibility.organizationId)) {
                    continue;
                }

                const organization = this.family.getOrganization(responsibility.organizationId);
                if (organization) {
                    base.push(organization);
                }
            }
        }

        return base;
    }

    get groups() {
        return this.filterGroups({ currentPeriod: true, includeFuture: false, includePending: false, types: [GroupType.Membership, GroupType.WaitingList] });
    }

    get registrationDescription() {
        const groups = this.groups;
        if (groups.length === 0) {
            return $t('57109b34-1238-4e62-84a0-14a81d7c2bfa');
        }
        return groups.map(g => g.settings.name).join(', ');
    }

    insertOrganization(organization: Organization) {
        this.family.insertOrganization(organization);
    }

    canRegister(group: Group, organization: Organization) {
        const item = RegisterItem.defaultFor(this, group, organization);

        const error = item.validationError;
        if (error === null) {
            return true;
        }

        return false;
    }

    canRegisterForWaitingList(group: Group, organization: Organization) {
        const item = RegisterItem.defaultFor(this, group, organization);

        const error = item.validationErrorForWaitingList;
        if (error === null) {
            return true;
        }

        return false;
    }

    get patchedMember() {
        if (this._savingPatch) {
            return this.member.patch(this._savingPatch).patch(this.patch);
        }
        return this.member.patch(this.patch);
    }

    doesMatchFilter(filter: StamhoofdFilter) {
        return this.patchedMember.doesMatchFilter(filter);
    }

    getAllRecordCategories(options?: { scopeOrganization?: Organization | null }): RecordCategory[] {
        // From organization
        const categories: RecordCategory[] = [];
        categories.push(...this.platform.config.recordsConfiguration.recordCategories);

        if (options?.scopeOrganization) {
            categories.push(...options.scopeOrganization.meta.recordsConfiguration.recordCategories);
        }
        else {
            for (const organization of this.filterOrganizations({ currentPeriod: true })) {
                categories.push(...organization.meta.recordsConfiguration.recordCategories);
            }
        }

        return categories;
    }

    getEnabledRecordCategories(options: { checkPermissions?: { user: UserWithMembers; level: PermissionLevel } | null;
        scopeOrganization?: Organization | null;
        scopeGroup?: Group | null;
        scopeGroups?: Group[] | null;
    }): { categories: RecordCategory[]; adminPermissionsMap: Map<string, boolean> } {
        const categories: RecordCategory[] = [];
        const adminPermissionsMap = new Map<string, boolean>();

        const checkPermissions = options.checkPermissions;
        const isUserManager = options.checkPermissions?.user.members.members.some(m => m.id === this.id) ?? false;
        if (!isUserManager && (checkPermissions && !checkPermissions.user.permissions)) {
            return { categories, adminPermissionsMap };
        }

        // From organization
        const scopedOrganizations = options.scopeOrganization ? [options.scopeOrganization] : this.filterOrganizations({ currentPeriod: true });
        const recordsConfigurations = this.filterRecordsConfigurations({
            currentPeriod: (options.scopeGroups || options.scopeGroup) ? undefined : true,
            groups: options.scopeGroups ? options.scopeGroups : (options.scopeGroup ? [options.scopeGroup] : null),
            organizationId: options.scopeOrganization?.id ?? undefined,
        });

        for (const recordsConfiguration of recordsConfigurations) {
            for (const recordCategory of recordsConfiguration.recordCategories) {
                if (categories.find(c => c.id === recordCategory.id)) {
                    // Already added
                    continue;
                }

                if (recordCategory.isEnabled(this)) {
                    if (checkPermissions) {
                        let hasUserManagerPermissions = false;
                        let hasAdminPermissions = false;
                        if (isUserManager) {
                            hasUserManagerPermissions = recordCategory.checkPermissionForUserManager(checkPermissions.level);
                        }
                        if (!hasUserManagerPermissions && checkPermissions.user.permissions) {
                            // Check permissions
                            // we need at least permission in one organization where this member is registered
                            for (const organization of scopedOrganizations) {
                                const organizationPermissions = checkPermissions.user.permissions.forOrganization(organization, Platform.shared);

                                if (!organizationPermissions) {
                                    continue;
                                }

                                if (organizationPermissions.hasResourceAccess(PermissionsResourceType.RecordCategories, recordCategory.id, checkPermissions.level)) {
                                    hasAdminPermissions = true;
                                    break;
                                }
                            }
                        }

                        if (!hasUserManagerPermissions && !hasAdminPermissions) {
                            continue;
                        }
                        if (hasAdminPermissions) {
                            /**
                             * If the user has admin permissions to this record category, we'll cache this
                             * This will make sure that we won't filter individual records inside the category by their
                             * user manager permissions (some fields are hidden for user managers, or read-only)
                             */
                            adminPermissionsMap.set(recordCategory.id, true);
                        }
                    }

                    categories.push(recordCategory);
                }
            }
        }

        return {
            categories,
            adminPermissionsMap,
        };
    }

    isExistingMember(organization: Organization): boolean {
        for (const registration of this.member.registrations) {
            if (registration.organizationId !== organization.id) {
                continue;
            }
            if (registration.group.periodId !== organization.period.period.id && registration.group.periodId !== organization.period.period.previousPeriodId && registration.group.periodId !== organization.period.period.nextPeriodId) {
                continue;
            }
            if (registration.group.type === GroupType.Membership && registration.registeredAt !== null && registration.deactivatedAt === null) {
                return true;
            }
        }

        return false;
    }

    isRecordEnabled(record: RecordSettings): boolean {
        if (record.sensitive && this.patchedMember.details.dataPermissions?.value === false) {
            return false;
        }
        return true;
    }

    getRecordAnswers(): Map<string, RecordAnswer> {
        return this.patchedMember.details.recordAnswers;
    }

    patchRecordAnswers(patch: PatchAnswers): this {
        const cloned = this.clone();
        cloned.addDetailsPatch(
            MemberDetails.patch({
                recordAnswers: patch,
            }),
        );
        return cloned as this;
    }

    getResponsibilities(filter?: { organization?: Organization | null | undefined }) {
        return this.patchedMember.responsibilities
            .filter(r => r.isActive && (filter?.organization === undefined || (filter.organization ? r.organizationId === filter.organization.id : r.organizationId === null)));
    }

    static sorterByName(sortDirection = 'ASC') {
        const memberSorter = Member.sorterByName(sortDirection);
        return (a: PlatformMember, b: PlatformMember) => {
            return memberSorter(a.member, b.member);
        };
    }
}
