import { DataRetentionRun, DataRetentionRunPhase } from '@stamhoofd/models';
import {
    DataRetentionAction,
    DataRetentionCategory,
    DataRetentionCount,
    DataRetentionOverview,
} from '@stamhoofd/structures';

import { Formatter } from '@stamhoofd/utility';
import { DateTime } from 'luxon';

import type { DataRetentionDecision, MemberRetentionFacts } from './DataRetentionPlanner.js';
import { planDeletion, planMember, planOrder } from './DataRetentionPlanner.js';
import { DataRetentionFactsLoader } from './DataRetentionFactsLoader.js';

const BATCH_SIZE = 100;
const ORGANIZATION_BATCH_SIZE = 10;

/**
 * The cursor of the PlatformData phase, which has a single step, once that step ran.
 */
const PLATFORM_DATA_DONE = 'done';

const NEXT_PHASE: Record<DataRetentionRunPhase, DataRetentionRunPhase | null> = {
    [DataRetentionRunPhase.Members]: DataRetentionRunPhase.Orders,
    [DataRetentionRunPhase.Orders]: DataRetentionRunPhase.OrganizationData,
    [DataRetentionRunPhase.OrganizationData]: DataRetentionRunPhase.PlatformData,
    [DataRetentionRunPhase.PlatformData]: DataRetentionRunPhase.Accounts,
    [DataRetentionRunPhase.Accounts]: null,
};

/**
 * Counts what the retention terms would do, without changing any data.
 * The result is what the overview shows, and lets us compare the numbers with production before anything is processed.
 */
export class DataRetentionCounter {
    /**
     * Continues the run where it stopped, until the deadline or after processing maxBatches batches. Returns true when the run is complete.
     */
    static async continueRun(
        run: DataRetentionRun,
        {
            deadline,
            batchSize = BATCH_SIZE,
            maxBatches = Infinity,
        }: { deadline: Date; batchSize?: number; maxBatches?: number },
    ): Promise<boolean> {
        if (!run.phase) {
            run.phase = DataRetentionRunPhase.Members;
            run.cursor = null;
            run.progress = new Map();
            run.startedAt = new Date();
            run.delayReportedAt = null;
        }

        let phase = run.phase;
        const loader = await DataRetentionFactsLoader.create(run.tenantId);
        // In userMode organization only organizations that turned it on can have terms: the rest is not counted
        const organizationIds =
            STAMHOOFD.userMode === 'organization'
                ? await DataRetentionFactsLoader.loadEnabledOrganizationIds()
                : undefined;

        let batches = 0;
        while (Date.now() < deadline.getTime() && batches < maxBatches) {
            if (
                await this.continuePhase(run, phase, loader, batchSize, new Date(), organizationIds)
            ) {
                batches += 1;
                continue;
            }

            const nextPhase = NEXT_PHASE[phase];
            if (!nextPhase) {
                await this.finish(run);
                return true;
            }
            phase = nextPhase;
            run.phase = phase;
            run.cursor = null;
        }

        await run.save();
        return false;
    }

    /**
     * Counts the next batch of the current phase. Returns false when the phase has nothing left.
     */
    private static async continuePhase(
        run: DataRetentionRun,
        phase: DataRetentionRunPhase,
        loader: DataRetentionFactsLoader,
        batchSize: number,
        now: Date,
        organizationIds: string[] | undefined,
    ): Promise<boolean> {
        switch (phase) {
            case DataRetentionRunPhase.Members: {
                const batch = await loader.loadMemberBatch(
                    run.cursor,
                    batchSize,
                    now,
                    organizationIds,
                );
                if (!batch) {
                    return false;
                }
                for (const memberFacts of batch.facts) {
                    const scopes = getScopes(getMemberOrganizationIds(memberFacts));
                    for (const decision of planMember(memberFacts, loader.index, now)) {
                        count(run, scopes, getMemberDecisionCategory(decision), decision, now);
                    }
                }
                run.cursor = batch.lastId;
                return true;
            }

            case DataRetentionRunPhase.Orders: {
                const batch = await loader.loadOrderBatch(run.cursor, batchSize, organizationIds);
                if (!batch) {
                    return false;
                }
                for (const orderFacts of batch.facts) {
                    const decision = planOrder(orderFacts, loader.index, now);
                    if (decision) {
                        count(
                            run,
                            getScopes([orderFacts.organizationId]),
                            DataRetentionCategory.Orders,
                            decision,
                            now,
                        );
                    }
                }
                run.cursor = batch.lastId;
                return true;
            }

            case DataRetentionRunPhase.OrganizationData: {
                // Each organization takes a few grouped queries, so fewer organizations fit in one batch
                const batch = await loader.loadOrganizationBatch(
                    run.cursor,
                    Math.min(batchSize, ORGANIZATION_BATCH_SIZE),
                    organizationIds,
                );
                if (!batch) {
                    return false;
                }
                for (const organizationId of batch.organizationIds) {
                    await countDates(run, loader, organizationId, now);
                }
                run.cursor = batch.lastId;
                return true;
            }

            case DataRetentionRunPhase.PlatformData: {
                // Without a platform, nothing follows a platform term
                if (STAMHOOFD.userMode !== 'platform' || run.cursor === PLATFORM_DATA_DONE) {
                    return false;
                }
                await countDates(run, loader, null, now);
                run.cursor = PLATFORM_DATA_DONE;
                return true;
            }

            case DataRetentionRunPhase.Accounts: {
                const batch = await loader.loadAccountBatch(run.cursor, batchSize, organizationIds);
                if (!batch) {
                    return false;
                }
                for (const account of batch.facts) {
                    count(
                        run,
                        getScopes([account.organizationId]),
                        DataRetentionCategory.Accounts,
                        planDeletion(
                            account.organizationId,
                            DataRetentionCategory.Accounts,
                            account.start,
                            loader.index,
                            now,
                        ),
                        now,
                    );
                }
                run.cursor = batch.lastId;
                return true;
            }
        }
    }

    /**
     * Replaces the result with the counts of this run, so the overview only ever shows a complete run,
     * and clears the progress so the next call starts a new run.
     */
    private static async finish(run: DataRetentionRun) {
        const calculatedAt = new Date();
        for (const overview of run.progress.values()) {
            overview.calculatedAt = calculatedAt;
        }
        run.result = run.progress;
        run.progress = new Map();
        run.phase = null;
        run.cursor = null;
        run.finishedAt = calculatedAt;
        await run.save();
    }
}

/**
 * E-mails, documents and audit logs of one organization, or those without an organization when organizationId is null.
 */
async function countDates(
    run: DataRetentionRun,
    loader: DataRetentionFactsLoader,
    organizationId: string | null,
    now: Date,
) {
    const scopes = getScopes([organizationId]);
    for (const { category, start, count: amount } of await loader.loadDateCounts(organizationId)) {
        count(
            run,
            scopes,
            category,
            planDeletion(organizationId, category, start, loader.index, now),
            now,
            amount,
        );
    }
}

/**
 * The organizations whose terms decide over this member, the same ones as the planner uses:
 * every organization it was registered at. Without registrations, a member only follows its own organization
 * in userMode organization, and only the platform otherwise.
 */
function getMemberOrganizationIds(facts: MemberRetentionFacts): (string | null)[] {
    if (facts.registrations.length > 0) {
        return facts.registrations.map((r) => r.organizationId);
    }
    return STAMHOOFD.userMode === 'platform' ? [] : [facts.organizationId];
}

/**
 * The keys in run.progress to count for: every organization involved, and in userMode platform also 'platform',
 * which counts each member or order once for the platform as a whole.
 */
function getScopes(organizationIds: (string | null)[]): string[] {
    const scopes = new Set<string>(organizationIds.filter((id) => id !== null));
    if (STAMHOOFD.userMode === 'platform') {
        scopes.add(DataRetentionRun.PLATFORM_SCOPE);
    }
    return [...scopes];
}

/**
 * A member has decisions for two categories: removing sensitive data belongs to sensitive data, the rest to members.
 */
export function getMemberDecisionCategory(decision: DataRetentionDecision): DataRetentionCategory {
    return decision.action === DataRetentionAction.RemoveSensitiveData
        ? DataRetentionCategory.SensitiveData
        : DataRetentionCategory.Members;
}

/**
 * Adds a decision for amount items to the progress of each scope, through addToCounts.
 */
function count(
    run: DataRetentionRun,
    scopes: string[],
    category: DataRetentionCategory,
    decision: DataRetentionDecision,
    now: Date,
    amount = 1,
) {
    if (!decision.dueAt) {
        return;
    }

    for (const scope of scopes) {
        const overview = run.progress.get(scope) ?? DataRetentionOverview.create({});
        run.progress.set(scope, overview);
        addToCounts(overview.counts, category, decision, now, amount);
    }
}

/**
 * Adds a decision for amount items to the counts, in exactly one of three buckets:
 * - upcoming, per month, when the term has not passed yet
 * - held, with each reason, when the term has passed but something holds it
 * - due, when the term has passed and nothing holds it
 *
 * Decisions without a due date (no term set) are not counted.
 */
export function addToCounts(
    counts: DataRetentionCount[],
    category: DataRetentionCategory,
    decision: DataRetentionDecision,
    now: Date,
    amount = 1,
) {
    if (!decision.dueAt) {
        return;
    }

    let count = counts.find((c) => c.category === category && c.action === decision.action);
    if (!count) {
        count = DataRetentionCount.create({ category, action: decision.action });
        counts.push(count);
    }

    if (decision.dueAt > now) {
        const month = getUpcomingMonth(decision.dueAt, now);
        count.upcoming.set(month, (count.upcoming.get(month) ?? 0) + amount);
    } else if (decision.heldBy.length > 0) {
        count.held += amount;
        for (const reason of decision.heldBy) {
            count.heldBy.set(reason, (count.heldBy.get(reason) ?? 0) + amount);
        }
    } else {
        count.due += amount;
    }
}

/**
 * The key in DataRetentionCount.upcoming: the month of the due date as yyyy-mm in Belgian time,
 * or 'later' after the current month and the 12 months after it.
 */
function getUpcomingMonth(dueAt: Date, now: Date): string {
    const limit = DateTime.fromJSDate(now, { zone: Formatter.timezone })
        .startOf('month')
        .plus({ months: 13 });
    if (dueAt >= limit.toJSDate()) {
        return 'later';
    }
    return DateTime.fromJSDate(dueAt, { zone: Formatter.timezone }).toFormat('yyyy-MM');
}
