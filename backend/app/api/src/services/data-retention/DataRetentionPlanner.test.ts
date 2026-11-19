import {
    DataRetentionAction,
    DataRetentionCategory,
    DataRetentionHoldReason,
    DataRetentionPolicy,
    DataRetentionTerms,
} from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';

import type { MemberRetentionFacts, OrderRetentionFacts } from './DataRetentionPlanner.js';
import { DataRetentionPolicyIndex, planMember, planOrder } from './DataRetentionPlanner.js';

const now = new Date('2026-06-15T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

type Terms = {
    anonymizeAfterMonths?: number | null;
    deleteAfterMonths?: number | null;
    protectedPeriods?: number | null;
};
type Policies = Partial<
    Record<DataRetentionCategory, Terms & { pending?: Terms; pendingFrom?: Date }>
>;

function policies(map: Policies) {
    return new Map(
        Object.entries(map).map(([category, { pending, pendingFrom, ...terms }]) => [
            category as DataRetentionCategory,
            DataRetentionPolicy.create({
                category: category as DataRetentionCategory,
                terms: DataRetentionTerms.create(terms),
                pendingTerms: pending ? DataRetentionTerms.create(pending) : null,
                pendingFrom: pendingFrom ?? null,
            }),
        ]),
    );
}

/**
 * Periods p1 -> p2 -> p3 -> p4, where p4 is the current period of every organization.
 */
function index({
    platform = {},
    organizations = {},
    previousPeriodIds = new Map([
        ['p4', 'p3'],
        ['p3', 'p2'],
        ['p2', 'p1'],
        ['p1', null],
    ]),
}: {
    platform?: Policies | null;
    organizations?: Record<string, Policies>;
    previousPeriodIds?: Map<string, string | null>;
}) {
    return new DataRetentionPolicyIndex({
        platform: platform ? policies(platform) : null,
        organizations: new Map(
            Object.entries(organizations).map(([id, map]) => [id, policies(map)]),
        ),
        getDefault: (_, category) => DataRetentionPolicy.create({ category }),
        currentPeriodIds: new Map([
            ['A', 'p4'],
            ['B', 'p4'],
        ]),
        previousPeriodIds,
    });
}

function member(facts: Partial<MemberRetentionFacts> = {}): MemberRetentionFacts {
    return {
        createdAt: new Date('2015-01-01T00:00:00.000Z'),
        organizationId: null,
        anonymizedAt: null,
        registrations: [],
        memberships: [],
        hasActiveResponsibility: false,
        hasAdminAccount: false,
        hasOpenBalance: false,
        ...facts,
    };
}

function registration(organizationId: string, endDate: string, periodId = 'p1') {
    return { organizationId, periodId, endDate: new Date(endDate) };
}

function decision(decisions: ReturnType<typeof planMember>, action: DataRetentionAction) {
    return decisions.find((d) => d.action === action);
}

describe('DataRetentionPlanner', () => {
    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    describe('planMember', () => {
        test('Without any term nothing happens', () => {
            const decisions = planMember(
                member({ registrations: [registration('A', '2018-08-31')] }),
                index({}),
                now,
            );

            for (const d of decisions) {
                expect(d.dueAt).toBeNull();
            }
        });

        test('The term starts at the end of the last registration', () => {
            const decisions = planMember(
                member({
                    registrations: [
                        registration('A', '2018-08-31'),
                        registration('A', '2020-08-31'),
                    ],
                }),
                index({
                    platform: { [DataRetentionCategory.Members]: { anonymizeAfterMonths: 24 } },
                }),
                now,
            );

            expect(decision(decisions, DataRetentionAction.Anonymize)).toEqual({
                action: DataRetentionAction.Anonymize,
                dueAt: new Date('2022-08-31'),
                heldBy: [],
            });
        });

        test('Without registrations, the term starts when the member was created and follows the platform', () => {
            const decisions = planMember(
                member({ createdAt: new Date('2024-01-01') }),
                index({ platform: { [DataRetentionCategory.Members]: { deleteAfterMonths: 12 } } }),
                now,
            );

            expect(decision(decisions, DataRetentionAction.Delete)?.dueAt).toEqual(
                new Date('2025-01-01'),
            );
        });

        test('Without registrations and without a platform, the member follows its own organization', () => {
            TestUtils.setEnvironment('userMode', 'organization');
            const policyIndex = index({
                platform: null,
                organizations: {
                    A: { [DataRetentionCategory.Members]: { deleteAfterMonths: 12 } },
                },
            });

            expect(
                decision(
                    planMember(
                        member({ createdAt: new Date('2024-01-01'), organizationId: 'A' }),
                        policyIndex,
                        now,
                    ),
                    DataRetentionAction.Delete,
                )?.dueAt,
            ).toEqual(new Date('2025-01-01'));
            expect(
                decision(
                    planMember(member({ createdAt: new Date('2024-01-01') }), policyIndex, now),
                    DataRetentionAction.Delete,
                )?.dueAt,
            ).toBeNull();
        });

        test('A member of several organizations follows the longest term of all of them', () => {
            const decisions = planMember(
                member({
                    registrations: [
                        registration('A', '2020-08-31'),
                        registration('B', '2019-08-31'),
                    ],
                }),
                index({
                    platform: { [DataRetentionCategory.Members]: { anonymizeAfterMonths: 12 } },
                    organizations: {
                        B: { [DataRetentionCategory.Members]: { anonymizeAfterMonths: 48 } },
                    },
                }),
                now,
            );

            // A: 2020-08-31 + 12 months, B: 2019-08-31 + 48 months
            expect(decision(decisions, DataRetentionAction.Anonymize)?.dueAt).toEqual(
                new Date('2023-08-31'),
            );
        });

        test('If one organization has no term at all, the member is kept', () => {
            TestUtils.setEnvironment('userMode', 'organization');
            const decisions = planMember(
                member({
                    registrations: [
                        registration('A', '2018-08-31'),
                        registration('B', '2018-08-31'),
                    ],
                }),
                index({
                    platform: null,
                    organizations: {
                        A: { [DataRetentionCategory.Members]: { anonymizeAfterMonths: 12 } },
                    },
                }),
                now,
            );

            expect(decision(decisions, DataRetentionAction.Anonymize)?.dueAt).toBeNull();
        });

        test('Sensitive data follows its own term', () => {
            const decisions = planMember(
                member({ registrations: [registration('A', '2025-08-31')] }),
                index({
                    platform: {
                        [DataRetentionCategory.SensitiveData]: { deleteAfterMonths: 6 },
                        [DataRetentionCategory.Members]: { anonymizeAfterMonths: 60 },
                    },
                }),
                now,
            );

            expect(decision(decisions, DataRetentionAction.RemoveSensitiveData)?.dueAt).toEqual(
                new Date('2026-02-28'),
            );
            expect(decision(decisions, DataRetentionAction.Anonymize)?.dueAt).toEqual(
                new Date('2030-08-31'),
            );
        });

        test('An anonymized member can only be deleted', () => {
            const decisions = planMember(
                member({
                    anonymizedAt: new Date('2025-01-01'),
                    registrations: [registration('A', '2018-08-31')],
                }),
                index({
                    platform: {
                        [DataRetentionCategory.Members]: {
                            anonymizeAfterMonths: 12,
                            deleteAfterMonths: 24,
                        },
                    },
                }),
                now,
            );

            expect(decisions.map((d) => d.action)).toEqual([DataRetentionAction.Delete]);
        });

        test('Deleting waits for anonymizing when the levels conflict', () => {
            const decisions = planMember(
                member({ registrations: [registration('A', '2020-08-31')] }),
                index({
                    platform: { [DataRetentionCategory.Members]: { deleteAfterMonths: 36 } },
                    organizations: {
                        A: { [DataRetentionCategory.Members]: { anonymizeAfterMonths: 60 } },
                    },
                }),
                now,
            );

            expect(decision(decisions, DataRetentionAction.Delete)?.dueAt).toEqual(
                new Date('2025-08-31'),
            );
        });

        describe('Pending changes', () => {
            const platformWith = (pendingFrom: Date) =>
                index({
                    platform: {
                        [DataRetentionCategory.Members]: {
                            anonymizeAfterMonths: 120,
                            pending: { anonymizeAfterMonths: 12 },
                            pendingFrom,
                        },
                    },
                });

            test('A shorter pending term only applies from pendingFrom', () => {
                const pendingFrom = new Date(now.getTime() + 20 * DAY);
                const decisions = planMember(
                    member({ registrations: [registration('A', '2018-08-31')] }),
                    platformWith(pendingFrom),
                    now,
                );

                expect(decision(decisions, DataRetentionAction.Anonymize)?.dueAt).toEqual(
                    pendingFrom,
                );
            });

            test('Data that is due under the new term later than pendingFrom follows the new term', () => {
                const decisions = planMember(
                    member({ registrations: [registration('A', '2026-03-31')] }),
                    platformWith(new Date(now.getTime() + 20 * DAY)),
                    now,
                );

                expect(decision(decisions, DataRetentionAction.Anonymize)?.dueAt).toEqual(
                    new Date('2027-03-31'),
                );
            });

            test('A platform that removes its term only keeps applying its term until pendingFrom', () => {
                const pendingFrom = new Date(now.getTime() + 20 * DAY);
                const policyIndex = index({
                    platform: {
                        [DataRetentionCategory.Members]: {
                            anonymizeAfterMonths: 12,
                            pending: {},
                            pendingFrom,
                        },
                    },
                });

                expect(
                    decision(
                        planMember(
                            member({ registrations: [registration('A', '2025-06-20')] }),
                            policyIndex,
                            now,
                        ),
                        DataRetentionAction.Anonymize,
                    )?.dueAt,
                ).toEqual(new Date('2026-06-20'));
                expect(
                    decision(
                        planMember(
                            member({ registrations: [registration('A', '2025-08-31')] }),
                            policyIndex,
                            now,
                        ),
                        DataRetentionAction.Anonymize,
                    )?.dueAt,
                ).toBeNull();
            });
        });

        describe('Holds', () => {
            const policyIndex = index({
                platform: {
                    [DataRetentionCategory.Members]: {
                        anonymizeAfterMonths: 12,
                        deleteAfterMonths: 12,
                        protectedPeriods: 2,
                    },
                },
            });
            const old = registration('A', '2018-08-31');

            test.each([
                {
                    reason: DataRetentionHoldReason.ActiveResponsibility,
                    facts: { registrations: [old], hasActiveResponsibility: true },
                },
                {
                    reason: DataRetentionHoldReason.AdminAccount,
                    facts: { registrations: [old], hasAdminAccount: true },
                },
                {
                    reason: DataRetentionHoldReason.OpenBalance,
                    facts: { registrations: [old], hasOpenBalance: true },
                },
            ])('$reason holds anonymizing and deleting', ({ reason, facts }) => {
                const decisions = planMember(member(facts), policyIndex, now);

                expect(decision(decisions, DataRetentionAction.Anonymize)?.heldBy).toContain(
                    reason,
                );
                expect(decision(decisions, DataRetentionAction.Delete)?.heldBy).toContain(reason);
            });

            test('A current or future membership holds, an expired one does not', () => {
                const expired = {
                    organizationId: 'A',
                    periodId: 'p1',
                    endDate: new Date('2019-08-31'),
                    isCharged: true,
                };
                const current = { ...expired, endDate: new Date('2026-08-31') };

                expect(
                    decision(
                        planMember(
                            member({ registrations: [old], memberships: [current] }),
                            policyIndex,
                            now,
                        ),
                        DataRetentionAction.Anonymize,
                    )?.heldBy,
                ).toContain(DataRetentionHoldReason.ActiveMembership);
                expect(
                    decision(
                        planMember(
                            member({ registrations: [old], memberships: [expired] }),
                            policyIndex,
                            now,
                        ),
                        DataRetentionAction.Anonymize,
                    )?.heldBy,
                ).toEqual([]);
            });

            test('A registration or membership in a protected period holds anonymizing and deleting', () => {
                const inPreviousPeriod = registration('A', '2018-08-31', 'p3');
                const membership = {
                    organizationId: 'A',
                    periodId: 'p4',
                    endDate: new Date('2019-08-31'),
                    isCharged: true,
                };

                for (const facts of [
                    { registrations: [inPreviousPeriod] },
                    { registrations: [old], memberships: [membership] },
                ]) {
                    const decisions = planMember(member(facts), policyIndex, now);
                    expect(decision(decisions, DataRetentionAction.Anonymize)?.heldBy).toEqual([
                        DataRetentionHoldReason.ProtectedPeriod,
                    ]);
                    expect(decision(decisions, DataRetentionAction.Delete)?.heldBy).toEqual([
                        DataRetentionHoldReason.ProtectedPeriod,
                    ]);
                }
            });

            test('Periods before the protected ones do not hold, and no protection holds nothing', () => {
                expect(
                    decision(
                        planMember(
                            member({ registrations: [registration('A', '2018-08-31', 'p2')] }),
                            policyIndex,
                            now,
                        ),
                        DataRetentionAction.Anonymize,
                    )?.heldBy,
                ).toEqual([]);

                const withoutProtection = index({
                    platform: { [DataRetentionCategory.Members]: { anonymizeAfterMonths: 12 } },
                });
                expect(
                    decision(
                        planMember(
                            member({ registrations: [registration('A', '2018-08-31', 'p4')] }),
                            withoutProtection,
                            now,
                        ),
                        DataRetentionAction.Anonymize,
                    )?.heldBy,
                ).toEqual([]);
            });

            test('An organization can protect more periods than the platform', () => {
                const policies = index({
                    platform: {
                        [DataRetentionCategory.Members]: {
                            anonymizeAfterMonths: 12,
                            protectedPeriods: 1,
                        },
                    },
                    organizations: {
                        A: { [DataRetentionCategory.Members]: { protectedPeriods: 3 } },
                    },
                });

                expect(
                    decision(
                        planMember(
                            member({ registrations: [registration('A', '2018-08-31', 'p2')] }),
                            policies,
                            now,
                        ),
                        DataRetentionAction.Anonymize,
                    )?.heldBy,
                ).toEqual([DataRetentionHoldReason.ProtectedPeriod]);
            });

            test('A membership that still has to be charged only holds deleting', () => {
                const uncharged = {
                    organizationId: 'A',
                    periodId: 'p1',
                    endDate: new Date('2019-08-31'),
                    isCharged: false,
                };
                const decisions = planMember(
                    member({ registrations: [old], memberships: [uncharged] }),
                    policyIndex,
                    now,
                );

                expect(decision(decisions, DataRetentionAction.Anonymize)?.heldBy).toEqual([]);
                expect(decision(decisions, DataRetentionAction.Delete)?.heldBy).toEqual([
                    DataRetentionHoldReason.UnchargedMembership,
                ]);
            });

            test('Sensitive data is not held, also not in a protected period', () => {
                const policies = index({
                    platform: {
                        [DataRetentionCategory.SensitiveData]: { deleteAfterMonths: 3 },
                        [DataRetentionCategory.Members]: { protectedPeriods: 2 },
                    },
                });
                const decisions = planMember(
                    member({
                        registrations: [registration('A', '2018-08-31', 'p4')],
                        hasOpenBalance: true,
                        hasAdminAccount: true,
                    }),
                    policies,
                    now,
                );

                expect(
                    decision(decisions, DataRetentionAction.RemoveSensitiveData)?.heldBy,
                ).toEqual([]);
            });

            test('A running registration at another organization keeps the term from starting', () => {
                const decisions = planMember(
                    member({ registrations: [old, registration('B', '2026-08-31')] }),
                    policyIndex,
                    now,
                );

                expect(decision(decisions, DataRetentionAction.Anonymize)?.dueAt).toEqual(
                    new Date('2027-08-31'),
                );
            });

            test('Holds are only reported once the term has passed', () => {
                const decisions = planMember(
                    member({
                        registrations: [registration('A', '2026-01-31')],
                        hasOpenBalance: true,
                    }),
                    policyIndex,
                    now,
                );

                expect(decision(decisions, DataRetentionAction.Anonymize)).toEqual({
                    action: DataRetentionAction.Anonymize,
                    dueAt: new Date('2027-01-31'),
                    heldBy: [],
                });
            });
        });
    });

    describe('getProtectedPeriodIds', () => {
        test('It returns the current period and the periods before it', () => {
            const policyIndex = index({
                platform: { [DataRetentionCategory.Members]: { protectedPeriods: 3 } },
            });

            expect(policyIndex.getProtectedPeriodIds('A', now)).toEqual(
                new Set(['p4', 'p3', 'p2']),
            );
        });

        test('It stops when the previous periods form a cycle', () => {
            const policyIndex = index({
                platform: { [DataRetentionCategory.Members]: { protectedPeriods: 3 } },
                previousPeriodIds: new Map([
                    ['p4', 'p3'],
                    ['p3', 'p4'],
                ]),
            });

            expect(policyIndex.getProtectedPeriodIds('A', now)).toEqual(new Set(['p4', 'p3']));
        });
    });

    describe('planOrder', () => {
        const policyIndex = index({
            platform: { [DataRetentionCategory.Orders]: { anonymizeAfterMonths: 12 } },
        });

        function order(facts: Partial<OrderRetentionFacts> = {}): OrderRetentionFacts {
            return {
                organizationId: 'A',
                createdAt: new Date('2024-01-01'),
                eventDate: null,
                anonymizedAt: null,
                hasOpenBalance: false,
                ...facts,
            };
        }

        test('The term starts at the order date, or at the event when that is later', () => {
            expect(planOrder(order(), policyIndex, now)?.dueAt).toEqual(new Date('2025-01-01'));
            expect(
                planOrder(order({ eventDate: new Date('2024-06-01') }), policyIndex, now)?.dueAt,
            ).toEqual(new Date('2025-06-01'));
            expect(
                planOrder(order({ eventDate: new Date('2023-06-01') }), policyIndex, now)?.dueAt,
            ).toEqual(new Date('2025-01-01'));
        });

        test('An open balance holds the order', () => {
            expect(planOrder(order({ hasOpenBalance: true }), policyIndex, now)?.heldBy).toEqual([
                DataRetentionHoldReason.OpenBalance,
            ]);
        });

        test('An anonymized order is done', () => {
            expect(
                planOrder(order({ anonymizedAt: new Date('2025-02-01') }), policyIndex, now),
            ).toBeNull();
        });

        test('The term of the organization counts when it is longer', () => {
            const policies = index({
                platform: { [DataRetentionCategory.Orders]: { anonymizeAfterMonths: 12 } },
                organizations: {
                    A: { [DataRetentionCategory.Orders]: { anonymizeAfterMonths: 36 } },
                },
            });

            expect(planOrder(order(), policies, now)?.dueAt).toEqual(new Date('2027-01-01'));
        });
    });
});
