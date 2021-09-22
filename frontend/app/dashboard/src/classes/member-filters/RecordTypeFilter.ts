import { LegacyRecordType, MemberWithRegistrations, Organization, LegacyRecordTypeHelper } from '@stamhoofd/structures';

import { DescriptiveFilter, Filter } from "./Filter";

export class RecordTypeFilter implements Filter, DescriptiveFilter {
    category: string;

    constructor(category: string) {
        this.category = category
    }

    getName(): string {
        return this.category;
    }

    doesMatch(member: MemberWithRegistrations, organization: Organization): boolean {
        if (!member.details) {
            return false;
        }

        const records = organization.meta.recordsConfiguration.filterForDisplay(
            member.details?.records ?? [], 
            member.details?.age ?? null
        ) 

        return records.some((record) => {
            return LegacyRecordTypeHelper.getFilterCategory(record.type) === this.category
        });
    }

    static generateAll() {
        const types = Object.values(LegacyRecordType)
        const map = new Map<string, RecordTypeFilter>()
        for (const type of types) {
            const category = LegacyRecordTypeHelper.getFilterCategory(type)
            if (category && !map.has(category)) {
                map.set(category, new RecordTypeFilter(category))
            }
        }
        return [...map.values()]
    }

    getDescription(member: MemberWithRegistrations, organization: Organization): string {
        if (!member.details) {
            return "";
        }

        const records = organization.meta.recordsConfiguration.filterForDisplay(
            member.details?.records ?? [], 
            member.details?.age ?? null
        ) 

        return records.flatMap((record) => {
            if (LegacyRecordTypeHelper.getFilterCategory(record.type) === this.category) {
                return [LegacyRecordTypeHelper.getName(record.type)+(record.description.length > 0 ? ": "+record.description : "")]
            }
            return []
        }).join("\n");
    }
}
