import { AutoEncoderPatchType } from "@simonbackx/simple-encoding"

import { baseInMemoryFilterCompilers, compileToInMemoryFilter, createInMemoryFilterCompiler, InMemoryFilterDefinitions } from "../filters/new/InMemoryFilter"
import { StamhoofdFilter } from "../filters/new/StamhoofdFilter"
import { Group } from "../Group"
import { Organization } from "../Organization"
import { Platform } from "../Platform"
import { RegisterCheckout, RegisterItem } from "./checkout/RegisterCheckout"
import { MembersBlob, MemberWithRegistrationsBlob } from "./MemberWithRegistrationsBlob"
import { ObjectWithRecords, PatchAnswers } from "./ObjectWithRecords"
import { RecordAnswer } from "./records/RecordAnswer"
import { RecordCategory } from "./records/RecordCategory"
import { RecordSettings } from "./records/RecordSettings"

export const platformMemberInMemoryFilterCompilers: InMemoryFilterDefinitions = {
    ...baseInMemoryFilterCompilers,
    age: createInMemoryFilterCompiler('details.age'),
}


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
}

export class PlatformMember implements ObjectWithRecords {
    member: MemberWithRegistrationsBlob
    patch: AutoEncoderPatchType<MemberWithRegistrationsBlob>
    family: PlatformFamily

    get id() {
        return this.member.id
    }

    constructor(data: {
        member: MemberWithRegistrationsBlob, 
        family: PlatformFamily
    }) {
        this.member = data.member
        this.patch = MemberWithRegistrationsBlob.patch({id: this.member.id})
        this.family = data.family
    }

    get organizations() {
        return this.family.organizations
    }

    get platform() {
        return this.family.platform
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
        return this.member.patch(this.patch)
    }

    doesMatchFilter(filter: StamhoofdFilter)  {
        try {
            const compiledFilter = compileToInMemoryFilter(filter, platformMemberInMemoryFilterCompilers)
            return compiledFilter(this.patchedMember)
        } catch (e) {
            console.error('Error while compiling filter', e, filter);
        }
        return false;
    }

    getAllRecordCategories(): RecordCategory[] {
        // From organization
        const categories: RecordCategory[] = [];
        for (const organization of this.organizations) {
            categories.push(...organization.meta.recordsConfiguration.recordCategories)
        }

        // Todo: read from platform
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

    isRecordCategoryEnabled(recordCategory: RecordCategory): boolean {
        return false;
    }

    isRecordEnabled(record: RecordSettings): boolean {
        if (record.sensitive && !this.patchedMember.details.dataPermissions?.value) {
            return false;
        }
        return true;
    }

    getRecordAnswers(): Map<string, RecordAnswer> {
        return new Map();
        //return this.patchedMember.details.recordAnswers
    }
    patchRecordAnswers(patch: PatchAnswers): this {
        throw new Error("Method not implemented.");
    }
}
