import type { DataRetentionRun } from '@stamhoofd/models';
import { DataRetentionRunPhase } from '@stamhoofd/models';
import {
    DataRetentionAction,
    DataRetentionCategory,
    DataRetentionCount,
    DataRetentionOverview,
} from '@stamhoofd/structures';

import { Formatter } from '@stamhoofd/utility';
import { DateTime } from 'luxon';

import type { DataRetentionDecision, MemberRetentionFacts } from './DataRetentionPlanner.js';
import { planMember, planOrder } from './DataRetentionPlanner.js';
import { DataRetentionFactsLoader } from './DataRetentionFactsLoader.js';

const BATCH_SIZE = 100;
const PLATFORM_SCOPE = 'platform';

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
        }

        const loader = await DataRetentionFactsLoader.create(run.tenantId);

        let batches = 0;
        while (Date.now() < deadline.getTime() && batches < maxBatches) {
            const now = new Date();

            if (run.phase === DataRetentionRunPhase.Members) {
                const batch = await loader.loadMemberBatch(run.cursor, batchSize, now);
                if (!batch) {
                    run.phase = DataRetentionRunPhase.Orders;
                    run.cursor = null;
                    continue;
                }

                for (const memberFacts of batch.facts) {
                    const scopes = getScopes(getMemberOrganizationIds(memberFacts));
                    for (const decision of planMember(memberFacts, loader.index, now)) {
                        count(
                            run,
                            scopes,
                            decision.action === DataRetentionAction.RemoveSensitiveData
                                ? DataRetentionCategory.SensitiveData
                                : DataRetentionCategory.Members,
                            decision,
                            now,
                        );
                    }
                }
                run.cursor = batch.lastId;
                batches += 1;
                continue;
            }

            const batch = await loader.loadOrderBatch(run.cursor, batchSize);
            if (!batch) {
                await this.finish(run);
                return true;
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
            batches += 1;
        }

        await run.save();
        return false;
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
        scopes.add(PLATFORM_SCOPE);
    }
    return [...scopes];
}

/**
 * Adds one decision to the progress of each scope, in exactly one of three buckets:
 * - upcoming, per month, when the term has not passed yet
 * - held, with each reason, when the term has passed but something holds it
 * - due, when the term has passed and nothing holds it
 *
 * Decisions without a due date (no term set) are not counted.
 */
function count(
    run: DataRetentionRun,
    scopes: string[],
    category: DataRetentionCategory,
    decision: DataRetentionDecision,
    now: Date,
) {
    if (!decision.dueAt) {
        return;
    }

    for (const scope of scopes) {
        const overview = run.progress.get(scope) ?? DataRetentionOverview.create({});
        run.progress.set(scope, overview);

        let counts = overview.counts.find(
            (c) => c.category === category && c.action === decision.action,
        );
        if (!counts) {
            counts = DataRetentionCount.create({ category, action: decision.action });
            overview.counts.push(counts);
        }

        if (decision.dueAt > now) {
            const month = getUpcomingMonth(decision.dueAt, now);
            counts.upcoming.set(month, (counts.upcoming.get(month) ?? 0) + 1);
        } else if (decision.heldBy.length > 0) {
            counts.held += 1;
            for (const reason of decision.heldBy) {
                counts.heldBy.set(reason, (counts.heldBy.get(reason) ?? 0) + 1);
            }
        } else {
            counts.due += 1;
        }
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
