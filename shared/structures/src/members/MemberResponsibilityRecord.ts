import { AutoEncoder, DateDecoder, StringDecoder, field } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';
import { Group } from '../Group.js';
import { type PlatformMember } from './PlatformMember.js';
import { AuditLogReplacement } from '../AuditLogReplacement.js';

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
}

export class MemberResponsibilityRecord extends MemberResponsibilityRecordBase {
    @field({ decoder: Group, nullable: true, version: 328 })
    group: Group | null = null;

    getName(member: PlatformMember, includeOrganization = true) {
        let allResponsibilities = member.family.platform.config.responsibilities;

        let suffix = (this.group ? ' ' + $t(`e9ec956f-3a71-4460-b09d-dfec22a1aaf0`) + ' ' + this.group.settings.name : '');

        if (this.organizationId) {
            const organization = member.family.getOrganization(this.organizationId);
            if (organization && organization.privateMeta) {
                allResponsibilities = [...allResponsibilities, ...organization.privateMeta.responsibilities];
            }

            if (organization && includeOrganization) {
                suffix += ' ' + $t(`4d72ebf2-dd5a-49cf-b5a0-dac956b6f2de`) + ' ' + organization.name;
            }
        }

        const responsibility = allResponsibilities.find(r => r.id == this.responsibilityId);
        return (responsibility ? responsibility.name : $t(`25c47121-5fa2-4b1b-b0bb-765752a81084`)) + suffix;
    }
}
