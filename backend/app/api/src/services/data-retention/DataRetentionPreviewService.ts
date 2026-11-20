import type { Organization } from '@stamhoofd/models';
import type { DataRetentionCount, DataRetentionTerms } from '@stamhoofd/structures';
import { DataRetentionCategory, DataRetentionPreview } from '@stamhoofd/structures';

import { TenantContext } from '../../helpers/TenantContext.js';
import { addToCounts, getMemberDecisionCategory } from './DataRetentionCounter.js';
import { DataRetentionFactsLoader } from './DataRetentionFactsLoader.js';
import type {
    DataRetentionDecision,
    DataRetentionPolicyIndex,
    MemberRetentionFacts,
} from './DataRetentionPlanner.js';
import { planDeletion, planMember, planOrder } from './DataRetentionPlanner.js';
import { DataRetentionPolicyService } from './DataRetentionPolicyService.js';

const BATCH_SIZE = 100;

/**
 * Counts what terms would do before they are saved, so saving can show what it will do.
 *
 * Only what the change itself causes is counted: what would be processed sooner, or at all, than under the current terms.
 * Data that the current terms or the platform already process is left out.
 *
 * Like the excel export, it only gets a few seconds: a count that does not finish in time is stopped, and the confirmation
 * refers to the overview after the next nightly count instead. The waiting time leaves enough time to cancel.
 */
export class DataRetentionPreviewService {
    static async preview(
        organization: Organization | null,
        category: DataRetentionCategory,
        terms: DataRetentionTerms,
        deadline: Date,
    ): Promise<DataRetentionPreview> {
        const planned = await DataRetentionPolicyService.planUpdate(
            organization,
            category,
            terms,
            new Date(),
        );

        // A change that does not wait never erases data sooner: there is nothing to confirm
        if (!planned.waits) {
            return DataRetentionPreview.create({ waits: false, from: planned.from });
        }

        const tenantId = TenantContext.currentOrRoot.tenantId;
        const organizationId = organization?.id ?? null;
        const loader = await DataRetentionFactsLoader.create(tenantId, {
            organizationId,
            policy: planned.policy,
        });
        const current = (await DataRetentionFactsLoader.create(tenantId)).index;

        const context: CountContext = {
            loader,
            current,
            organizationId,
            category,
            now: planned.from,
            counts: [],
            isOverDeadline: () => Date.now() > deadline.getTime(),
        };
        const complete = await countCategory(context);

        return DataRetentionPreview.create({
            waits: true,
            from: planned.from,
            counts: complete ? context.counts : null,
        });
    }
}

type CountContext = {
    /**
     * Loads the facts, and plans with the proposed terms.
     */
    loader: DataRetentionFactsLoader;
    /**
     * Plans with the terms as they are now, to leave out what does not change.
     */
    current: DataRetentionPolicyIndex;
    organizationId: string | null;
    category: DataRetentionCategory;
    /**
     * The moment the proposed terms apply: everything is counted as on that day.
     */
    now: Date;
    counts: DataRetentionCount[];
    isOverDeadline: () => boolean;
};

/**
 * Only counted when the proposed terms process it sooner than the current terms, or when only they process it.
 * What the current terms already process by the day the change applies is left out, even if the change would make it earlier.
 */
function addChange(
    { counts, category, now }: CountContext,
    proposed: DataRetentionDecision,
    current: DataRetentionDecision | undefined,
    amount = 1,
) {
    if (!proposed.dueAt) {
        return;
    }
    // Already processed by the time the change applies, or not later than with the change: not caused by it
    if (current?.dueAt && (current.dueAt <= now || current.dueAt <= proposed.dueAt)) {
        return;
    }
    addToCounts(counts, category, proposed, now, amount);
}

/**
 * Returns false when the deadline passed before everything was counted.
 */
async function countCategory(context: CountContext): Promise<boolean> {
    switch (context.category) {
        case DataRetentionCategory.Members:
        case DataRetentionCategory.SensitiveData:
            return await countMembers(context);
        case DataRetentionCategory.Orders:
            return await countOrders(context);
        case DataRetentionCategory.Accounts:
            return await countAccounts(context);
        case DataRetentionCategory.Emails:
        case DataRetentionCategory.Documents:
        case DataRetentionCategory.AuditLogs:
            return await countDates(context);
    }
}

async function countMembers(context: CountContext) {
    const { loader, current, organizationId, category, now, isOverDeadline } = context;
    const add = (facts: MemberRetentionFacts[]) => {
        for (const memberFacts of facts) {
            const currentDecisions = planMember(memberFacts, current, now);
            for (const decision of planMember(memberFacts, loader.index, now)) {
                if (getMemberDecisionCategory(decision) === category) {
                    addChange(
                        context,
                        decision,
                        currentDecisions.find((d) => d.action === decision.action),
                    );
                }
            }
        }
    };

    if (organizationId) {
        const memberIds = await loader.loadMemberIdsOfOrganization(organizationId);
        for (let index = 0; index < memberIds.length; index += BATCH_SIZE) {
            if (isOverDeadline()) {
                return false;
            }
            add(await loader.loadMembersByIds(memberIds.slice(index, index + BATCH_SIZE), now));
        }
        return true;
    }

    let cursor: string | null = null;
    for (;;) {
        if (isOverDeadline()) {
            return false;
        }
        const batch = await loader.loadMemberBatch(cursor, BATCH_SIZE, now);
        if (!batch) {
            return true;
        }
        add(batch.facts);
        cursor = batch.lastId;
    }
}

async function countOrders(context: CountContext) {
    const { loader, current, organizationId, now, isOverDeadline } = context;
    let cursor: string | null = null;
    for (;;) {
        if (isOverDeadline()) {
            return false;
        }
        const batch = await loader.loadOrderBatch(cursor, BATCH_SIZE, organizationId ?? undefined);
        if (!batch) {
            return true;
        }
        for (const orderFacts of batch.facts) {
            const decision = planOrder(orderFacts, loader.index, now);
            if (decision) {
                addChange(context, decision, planOrder(orderFacts, current, now) ?? undefined);
            }
        }
        cursor = batch.lastId;
    }
}

/**
 * Within a platform, accounts only have a platform term, so this only counts every account on the platform level.
 */
async function countAccounts(context: CountContext) {
    const { loader, current, organizationId, category, now, isOverDeadline } = context;
    let cursor: string | null = null;
    for (;;) {
        if (isOverDeadline()) {
            return false;
        }
        const batch = await loader.loadAccountBatch(
            cursor,
            BATCH_SIZE,
            organizationId ?? undefined,
        );
        if (!batch) {
            return true;
        }
        for (const account of batch.facts) {
            addChange(
                context,
                planDeletion(account.organizationId, category, account.start, loader.index, now),
                planDeletion(account.organizationId, category, account.start, current, now),
            );
        }
        cursor = batch.lastId;
    }
}

/**
 * The platform term applies to everything without an organization, and to every organization.
 * loadDateCounts also counts the other date categories; those are skipped.
 */
async function countDates(context: CountContext) {
    const { loader, current, organizationId, category, now, isOverDeadline } = context;
    const add = async (dateOrganizationId: string | null) => {
        for (const dateCount of await loader.loadDateCounts(dateOrganizationId)) {
            if (dateCount.category === category) {
                addChange(
                    context,
                    planDeletion(dateOrganizationId, category, dateCount.start, loader.index, now),
                    planDeletion(dateOrganizationId, category, dateCount.start, current, now),
                    dateCount.count,
                );
            }
        }
    };

    if (organizationId) {
        await add(organizationId);
        return true;
    }

    await add(null);
    let cursor: string | null = null;
    for (;;) {
        const batch = await loader.loadOrganizationBatch(cursor, BATCH_SIZE);
        if (!batch) {
            return true;
        }
        // Each organization takes a few grouped queries, so check the deadline for each of them
        for (const id of batch.organizationIds) {
            if (isOverDeadline()) {
                return false;
            }
            await add(id);
        }
        cursor = batch.lastId;
    }
}
