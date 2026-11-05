import { Factory } from '@node/database';
import type { MemberResponsibility } from '@stamhoofd/structures';

import type { Member } from '../models/index.js';
import { MemberResponsibilityRecord } from '../models/index.js';
import { PlatformResponsibilityFactory } from './PlatformResponsibilityFactory.js';

class Options {
    name?: string;
    responsibility?: MemberResponsibility;
    member: Member;
    organizationId?: string;
    startDate?: Date;
    endDate?: Date | null;
}

export class MemberResponsibilityRecordFactory extends Factory<Options, MemberResponsibilityRecord> {
    async create(): Promise<MemberResponsibilityRecord> {
        const record = new MemberResponsibilityRecord();
        const responsibility = this.options.responsibility ?? (await new PlatformResponsibilityFactory({
            organizationBased: !!this.options.organizationId,
        }).create());
        record.responsibilityId = this.options.responsibility?.id ?? responsibility.id;
        record.memberId = this.options.member.id;
        record.startDate = this.options.startDate ?? new Date();
        record.endDate = this.options.endDate ?? null;
        record.organizationId = this.options.organizationId ?? this.options.member.organizationId;

        if (!record.organizationId) {
            if (responsibility.organizationBased) {
                throw new Error('This responsibility is organization based. Please also provide the organizationId option when creating the record with MemberResponsibilityRecordFactory');
            }
        }

        await record.save();
        return record;
    }
}
