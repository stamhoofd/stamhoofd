import { column } from '@node/database';
import { QueryableModel } from '@stamhoofd/sql';
import type { DataRetentionCategory } from '@stamhoofd/structures';
import { DataRetentionPolicy as DataRetentionPolicyStruct, DataRetentionTerms } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';

const PLATFORM_SCOPE_ID = 'platform';

export class DataRetentionPolicy extends QueryableModel {
    static table = 'data_retention_policies';

    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    /**
     * The platform this policy belongs to. A policy of a platform has no organizationId, so this is what tells platforms apart.
     */
    @column({ type: 'string' })
    tenantId: string;

    @column({ type: 'string', nullable: true })
    organizationId: string | null = null;

    /**
     * Who set this policy: the organizationId, or 'platform'. Always derived from organizationId.
     * Only exists for the unique key: MySQL allows duplicate NULL values, so organizationId cannot prevent two policies for the platform.
     */
    @column({
        type: 'string', beforeSave(this: DataRetentionPolicy) {
            return this.organizationId ?? PLATFORM_SCOPE_ID;
        },
    })
    scopeId: string;

    @column({ type: 'string' })
    category: DataRetentionCategory;

    @column({ type: 'integer', nullable: true })
    anonymizeAfterMonths: number | null = null;

    @column({ type: 'integer', nullable: true })
    deleteAfterMonths: number | null = null;

    /**
     * Members only: members with a registration or membership in this many periods, including the current one, are not anonymized or deleted.
     */
    @column({ type: 'integer', nullable: true })
    protectedPeriods: number | null = null;

    @column({ type: 'integer', nullable: true })
    pendingAnonymizeAfterMonths: number | null = null;

    @column({ type: 'integer', nullable: true })
    pendingDeleteAfterMonths: number | null = null;

    @column({ type: 'integer', nullable: true })
    pendingProtectedPeriods: number | null = null;

    /**
     * When the pending values start to apply. Changes that can erase data sooner wait 30 days.
     * Null when no change is waiting. When set, a pending value of null removes that value.
     */
    @column({ type: 'datetime', nullable: true })
    pendingFrom: Date | null = null;

    @column({
        type: 'datetime', beforeSave(old?: any) {
            if (old !== undefined) {
                return old;
            }
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
    })
    createdAt: Date;

    @column({
        type: 'datetime', beforeSave() {
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
        skipUpdate: true,
    })
    updatedAt: Date;

    getStructure(): DataRetentionPolicyStruct {
        return DataRetentionPolicyStruct.create({
            category: this.category,
            terms: DataRetentionTerms.create({
                anonymizeAfterMonths: this.anonymizeAfterMonths,
                deleteAfterMonths: this.deleteAfterMonths,
                protectedPeriods: this.protectedPeriods,
            }),
            pendingTerms: this.pendingFrom
                ? DataRetentionTerms.create({
                    anonymizeAfterMonths: this.pendingAnonymizeAfterMonths,
                    deleteAfterMonths: this.pendingDeleteAfterMonths,
                    protectedPeriods: this.pendingProtectedPeriods,
                })
                : null,
            pendingFrom: this.pendingFrom,
        });
    }

    /**
     * The saved policy of this level, or the default policy of this level when nothing was saved yet.
     */
    static async getStructureFor(tenantId: string, organizationId: string | null, category: DataRetentionCategory): Promise<DataRetentionPolicyStruct> {
        const model = await DataRetentionPolicy.select()
            .where('tenantId', tenantId)
            .where('scopeId', organizationId ?? PLATFORM_SCOPE_ID)
            .where('category', category)
            .first(false);

        if (model) {
            return model.getStructure();
        }

        const isTopLevel = organizationId === null || STAMHOOFD.userMode === 'organization';
        return DataRetentionPolicyStruct.createDefault(category, { isTopLevel });
    }
}
