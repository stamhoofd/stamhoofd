import type { DataRetentionRun } from '@stamhoofd/models';
import { DataRetentionRunPhase, Member, Order } from '@stamhoofd/models';
import { SQL, SQLOrderBy, SQLWhereSign } from '@stamhoofd/sql';
import {
    DataRetentionAction,
    DataRetentionCategory,
    DataRetentionCount,
    DataRetentionOverview,
} from '@stamhoofd/structures';

import type { DataRetentionDecision } from './DataRetentionPlanner.js';
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
     * Continues the run where it stopped, until the deadline. Returns true when the run is complete.
     */
    static async continueRun(run: DataRetentionRun, deadline: Date): Promise<boolean> {
        if (!run.phase) {
            run.phase = DataRetentionRunPhase.Members;
            run.cursor = null;
            run.progress = new Map();
            run.startedAt = new Date();
        }

        const { index, periodEndDates } = await DataRetentionFactsLoader.loadPolicyIndex(
            run.tenantId,
        );

        while (Date.now() < deadline.getTime()) {
            const now = new Date();

            if (run.phase === DataRetentionRunPhase.Members) {
                const members = await Member.select()
                    .where('id', SQLWhereSign.Greater, run.cursor ?? '')
                    .orderBy(new SQLOrderBy({ column: SQL.column('id'), direction: 'ASC' }))
                    .limit(BATCH_SIZE)
                    .fetch();

                if (members.length === 0) {
                    run.phase = DataRetentionRunPhase.Orders;
                    run.cursor = null;
                    continue;
                }

                const facts = await DataRetentionFactsLoader.loadMemberFacts(
                    members,
                    periodEndDates,
                    now,
                );
                for (const memberFacts of facts.values()) {
                    // A member counts for every organization it was registered at, or for its own organization when it never registered
                    const scopes = getScopes([
                        ...memberFacts.registrations.map((r) => r.organizationId),
                        ...(memberFacts.registrations.length === 0
                            ? [memberFacts.organizationId]
                            : []),
                    ]);
                    for (const decision of planMember(memberFacts, index, now)) {
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
                run.cursor = members[members.length - 1].id;
                continue;
            }

            const orders = await Order.select()
                .where('id', SQLWhereSign.Greater, run.cursor ?? '')
                .where('anonymizedAt', null)
                .orderBy(new SQLOrderBy({ column: SQL.column('id'), direction: 'ASC' }))
                .limit(BATCH_SIZE)
                .fetch();

            if (orders.length === 0) {
                await this.finish(run);
                return true;
            }

            const facts = await DataRetentionFactsLoader.loadOrderFacts(orders);
            for (const orderFacts of facts.values()) {
                const decision = planOrder(orderFacts, index, now);
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
            run.cursor = orders[orders.length - 1].id;
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
 * The key in DataRetentionCount.upcoming: the month of the due date as yyyy-mm (UTC),
 * or 'later' when it is 12 months or more away.
 */
function getUpcomingMonth(dueAt: Date, now: Date): string {
    const limit = new Date(now);
    limit.setMonth(limit.getMonth() + 12);
    return dueAt < limit ? dueAt.toISOString().slice(0, 7) : 'later';
}
