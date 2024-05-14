import { AutoEncoderPatchType, PatchableArrayAutoEncoder } from "@simonbackx/simple-encoding"

import { Organization } from "../Organization"
import { Platform } from "../Platform"
import { Member } from "./Member"
import { MemberDetails } from "./MemberDetails"
import { MemberWithRegistrations } from "./MemberWithRegistrations"
import { MembersBlob,MemberWithRegistrationsBlob } from "./MemberWithRegistrationsBlob"
import { ObjectWithRecords } from "./ObjectWithRecords"
import { RecordAnswer } from "./records/RecordAnswer"
import { RecordCategory } from "./records/RecordCategory"
import { RecordSettings } from "./records/RecordSettings"

export class PlatformMember implements ObjectWithRecords {
    member: MemberWithRegistrationsBlob
    patch: AutoEncoderPatchType<Member>
    platform: Platform
    organizations: Organization[] = []

    constructor(data: {member: MemberWithRegistrationsBlob, platform: Platform, organizations: Organization[]}) {
        this.member = data.member
        this.patch = Member.patch({id: this.member.id})
        this.platform = data.platform
        this.organizations = data.organizations
    }

    insertOrganization(organization: Organization) {
        if (this.organizations.find(o => o.id === organization.id)) {
            return;
        }
        this.organizations.push(organization)
    }

    static createFrom(data: {member: MemberWithRegistrationsBlob, blob: MembersBlob, contextOrganization: Organization|null}) {
        // Gather all organizations
        let organizations = data.blob.organizations;

        if (data.contextOrganization && !organizations.find(o => o.id === data.contextOrganization!.id)) {
            organizations = [...organizations, data.contextOrganization]
        }

        return new PlatformMember({
            member: data.member,
            organizations,
            platform: Platform.shared
        })
    }

    get patchedMember() {
        return this.member.patch(this.patch)
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

    getAllRecordCategories(): RecordCategory[] {
        return []
    }

    getRecords(): RecordAnswer[] {
        return this.patchedMember.details.recordAnswers
    }

    patchRecords(patch: PatchableArrayAutoEncoder<RecordAnswer>) {
        this.patch = this.patch.patch({
            details: MemberDetails.patch({
                recordAnswers: patch
            })
        })
    }
}
