import { AutoEncoder, DateDecoder, StringDecoder, field } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';
import { Group } from '../Group.js';
import { GroupType } from '../GroupType.js';
import type { PlatformMember } from './PlatformMember.js';
import type { Registration } from './Registration.js';
import { AuditLogReplacement } from '../AuditLogReplacement.js';

/**
 * A member keeps a responsibility for 14 days after their last registration ends (grace period).
 */
export const AUTO_REMOVE_GRACE_MS = 1000 * 60 * 60 * 24 * 14;

export class MemberResponsibilityRecordBase extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    memberId: string;

    @field({ decoder: StringDecoder, nullable: true })
    organizationId: string | null = null;

    @field({ decoder: StringDecoder, nullable: true })
    groupId: string | null = null;

    @field({ decoder: StringDecoder })
    responsibilityId: string;

    @field({ decoder: DateDecoder })
    startDate: Date = new Date();

    @field({ decoder: DateDecoder, nullable: true })
    endDate: Date | null = null;

    get isActive() {
        return this.startDate <= new Date() && (this.endDate === null || this.endDate > new Date());
    }

    getDiffName() {
        return AuditLogReplacement.uuid(this.responsibilityId);
    }

    getAutoRemoveDate(registrations: Registration[], currentPeriod: { id: string; startDate: Date }, platformResponsibilityIds: string[]): Date | null {
        const now = new Date();

        // Rule A: Global (not organization-scoped) responsibilities are never auto-removed
        if (this.organizationId === null) {
            return null;
        }

        // Rule B: non-active records are never auto-removed
        if (this.startDate >= now || (this.endDate !== null && this.endDate <= now)) {
            return null;
        }

        const isRegistrationRelevant = (registration: Registration) => {
            if (registration.organizationId !== this.organizationId) {
                return false; // other org
            }
            if (registration.registeredAt === null) {
                return false; // not confirmed
            }
            if (registration.group.type.toString() !== GroupType.Membership.toString()) {
                return false; // not a membership group
            }
            if (registration.group.periodId !== currentPeriod.id) {
                return false; // other period
            }
            if (STAMHOOFD.userMode === 'platform' && platformResponsibilityIds.includes(this.responsibilityId) && registration.group.defaultAgeGroupId === null) {
                return false; // not a group tracked by platform
            }
            return true;
        };

        let endDate: Date | null = null;
        for (const registration of registrations) {
            if (!isRegistrationRelevant(registration)) {
                continue;
            }

            if ((registration.endDate === null || registration.endDate >= now) && registration.deactivatedAt === null) {
                if (registration.group.deletedAt === null) {
                    return null; // Rule C: records from members with an active registration (ongoing or not yet ended) are never auto-removed
                } else if (endDate === null || registration.group.deletedAt.getTime() > endDate.getTime()) {
                    endDate = registration.group.deletedAt; // Rule D1: an active registration whose group was deleted, makes the group's deletion date the end date
                }
            }

            if (registration.deactivatedAt && (endDate === null || registration.deactivatedAt.getTime() > endDate.getTime())) {
                endDate = registration.deactivatedAt; // Rule D2: end date can be the latest registration date (via deactivatedAt)
            }

            if (registration.endDate && registration.endDate < now && (endDate === null || registration.endDate.getTime() > endDate.getTime())) {
                endDate = registration.endDate; // Rule D3: end date can be the latest registration date (via endDate)
            }
        }

        if (endDate === null || endDate.getTime() < currentPeriod.startDate.getTime()) {
            endDate = currentPeriod.startDate; // Rule D4: end date can be the start of the current period if no other end date was found
        }
        return new Date(endDate.getTime() + AUTO_REMOVE_GRACE_MS);
    }
}

export class MemberResponsibilityRecord extends MemberResponsibilityRecordBase {
    @field({ decoder: Group, nullable: true, version: 328 })
    group: Group | null = null;

    getName(member: PlatformMember, includeOrganization = true) {
        let allResponsibilities = member.family.platform.config.responsibilities;

        let suffix = (this.group ? ' ' + $t(`%wR`) + ' ' + this.group.settings.name : '');

        if (this.organizationId) {
            const organization = member.family.getOrganization(this.organizationId);
            if (organization && organization.privateMeta) {
                allResponsibilities = [...allResponsibilities, ...organization.privateMeta.responsibilities];
            }

            if (organization && includeOrganization) {
                suffix += ' ' + $t(`%i0`) + ' ' + organization.name;
            }
        }

        const responsibility = allResponsibilities.find(r => r.id == this.responsibilityId);
        return (responsibility ? responsibility.name : $t(`%qZ`)) + suffix;
    }
}
