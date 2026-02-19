import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { SessionContext, useMemberManager, useRequestOwner } from '@stamhoofd/networking';
import { Event, getActivePeriodIds, GroupStatus, GroupType, LimitedFilteredRequest, PaginatedResponseDecoder, PayableBalanceCollection, Platform, PlatformFamily, PlatformMember, SortItemDirection, StamhoofdFilter, WebshopStatus } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, onActivated, onMounted, ref, Ref } from 'vue';
import { ErrorBox } from '../../errors/ErrorBox';
import { useErrors } from '../../errors/useErrors';
import { GlobalEventBus } from '../../EventBus';
import { useContext, useFeatureFlag, useUser } from '../../hooks';
import { useEditMember } from '../../members';
import { MemberStepManager } from '../../members/classes/MemberStepManager';
import { getAllMemberSteps } from '../../members/classes/steps';
import { useNavigationActions } from '../../types/NavigationActions';
import { QuickAction, QuickActions } from '../classes/QuickActions';

import { ComponentWithProperties, NavigationController, useNavigate, useShow } from '@simonbackx/vue-app-navigation';
import cartSvg from '@stamhoofd/assets/images/illustrations/cart.svg';
import emailWarningSvg from '@stamhoofd/assets/images/illustrations/email-warning.svg';
import missingDataSvg from '@stamhoofd/assets/images/illustrations/missing-data.svg';
import outstandingAmountSvg from '@stamhoofd/assets/images/illustrations/outstanding-amount.svg';
import { useVisibilityChange } from '../../composables';
import { EventView } from '../../events';
import EventIcon from '../../events/components/EventIcon.vue';

export function useRegistrationQuickActions(): QuickActions {
    const memberManager = useMemberManager();
    const checkout = computed(() => memberManager.family.checkout);
    const context = useContext();
    const navigate = useNavigationActions();
    const user = useUser();
    const editMember = useEditMember();
    const owner = useRequestOwner();
    const errors = useErrors();
    const $navigate = useNavigate();
    const show = useShow();
    const checkFeatureFlag = useFeatureFlag();

    async function openCart() {
        await GlobalEventBus.sendEvent('selectTabById', 'cart');
    }

    async function openEvent(event: Event) {
        const component = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(EventView, {
                event,
            }),
        });

        await show({
            components: [component],
        });
    }

    async function fillInMemberMissingData(member: PlatformMember) {
        const steps = getAllMemberSteps(member, null, { outdatedTime: null });
        const manager = new MemberStepManager(context.value, member, steps, async (navigate) => {
            await navigate.dismiss({ force: true });
        }, { action: 'present', modalDisplayStyle: 'popup' });

        await manager.saveHandler(null, navigate);
    }

    async function checkAllMemberData(member: PlatformMember) {
        await editMember(member, { title: $t(`d14e4e63-c77d-44d9-b8d0-adf05e299303`) });
    }

    const activeMembers = computed(() => memberManager.family.members.filter(m => m.filterRegistrations({ currentPeriod: true, types: [GroupType.Membership] }).length > 0));

    const membersWithMissingData = computed(() => activeMembers.value.flatMap((member) => {
        const steps = getAllMemberSteps(member, null, { outdatedTime: null });
        const manager = new MemberStepManager(context.value, member, steps, () => {});
        const activeSteps = steps.filter(s => s.isEnabled(manager));

        if (activeSteps.length > 0) {
            return [
                {
                    member,
                    steps: Formatter.joinLast(activeSteps.map(s => s.getName(manager)), ', ', ' en '),
                },
            ];
        }

        return [];
    }));

    const membersWithoutMissingData = computed(() => activeMembers.value.filter((member) => {
        return !membersWithMissingData.value.find(m => m.member.id === member.id);
    }));

    const membersWithMissingEmail = computed(() => {
        return membersWithoutMissingData.value.filter((member) => {
            return !member.patchedMember.details.hasEmail(user.value?.email ?? '');
        });
    });

    // Load outstanding amount
    console.log('Load outstanding balance setup');
    const outstandingBalance = ref(null) as Ref<PayableBalanceCollection | null>;
    let lastLoadedBalance = new Date(0);

    // Fetch balance
    async function updateBalance() {
        if (lastLoadedBalance.getTime() > new Date().getTime() - 5 * 60 * 1000) {
            return;
        }
        lastLoadedBalance = new Date();
        try {
            const response = await context.value.authenticatedServer.request({
                method: 'GET',
                path: `/user/payable-balance`,
                decoder: PayableBalanceCollection as Decoder<PayableBalanceCollection>,
                shouldRetry: true,
                owner,
                timeout: 5 * 60 * 1000,
            });

            outstandingBalance.value = response.data;
        }
        catch (e) {
            errors.errorBox = new ErrorBox(e);
        }
    }

    const featuredEvents: Ref<Event[] | null> = ref(null);

    async function fetchFeaturedEvents() {
        if (!checkFeatureFlag('STA-33')) {
            featuredEvents.value = [];
            return;
        }

        featuredEvents.value = await getFeaturedEventsForFamily({ context: context.value, family: memberManager.family, owner });
    }

    onMounted(() => {
        updateBalance().catch(console.error);
        fetchFeaturedEvents().catch(console.error);
    });

    onActivated(() => {
        updateBalance().catch(console.error);
    });

    useVisibilityChange(() => {
        updateBalance().catch(console.error);
    });

    return {
        actions: computed(() => {
            const arr: QuickAction[] = [];
            if (!checkout.value.cart.isEmpty) {
                arr.push({
                    illustration: cartSvg,
                    title: $t(`ecdcc78a-f91f-42e5-92f9-636225616c4c`),
                    description: checkout.value.cart.price > 0 ? $t(`ddff3e4b-56df-4279-8e91-b61011dfdb01`) : $t(`d73a6677-2a0d-456a-9c1a-85dccfc2c452`),
                    action: openCart,
                });
            }

            for (const organizationStatus of outstandingBalance.value?.organizations || []) {
                const open = organizationStatus.amountOpen;
                if (open <= 0) {
                    continue;
                }

                arr.push({
                    illustration: outstandingAmountSvg,
                    title: $t(`868011d2-7d0b-4739-955a-236d9cb6a39a`) + ' ' + organizationStatus.organization.name,
                    description: $t(`6d5ed993-d9a6-4573-b838-adf3beaf17a5`) + ' ' + Formatter.price(open) + ' ' + $t(`4d72ebf2-dd5a-49cf-b5a0-dac956b6f2de`) + ' ' + organizationStatus.organization.name + '',
                    rightText: Formatter.price(open),
                    rightTextClass: 'style-price',
                    action: async () => {
                        await $navigate('payments');
                    },
                });
            }

            for (const member of membersWithMissingData.value) {
                arr.push({
                    illustration: missingDataSvg,
                    title: $t(`b9bac60d-1fd8-43e7-9c9d-4b9b5227f9d6`, { member: member.member.patchedMember.firstName }),
                    description: $t(`77e44908-5498-4b91-9b4f-8e55cb282dc5`, { member: member.member.patchedMember.firstName }),
                    action: () => fillInMemberMissingData(member.member),
                });
            }

            for (const member of membersWithMissingEmail.value) {
                // Het e-mailadres van dit account is niet toegevoegd bij
                arr.push({
                    illustration: emailWarningSvg,
                    title: $t(`69385e1a-413f-4583-9061-67072d0742b9`, { member: member.patchedMember.firstName }),
                    description: $t(`9526c69d-cdbf-4c90-ae2b-a7a274e42c3c`, {
                        email: user.value?.email ?? '',
                        member: member.patchedMember.details.firstName,
                    }),
                    action: () => checkAllMemberData(member),
                });
            }

            for (const event of featuredEvents.value ?? []) {
                const group = event.group;

                if (group) {
                    /**
                     * check if at least 1 member can register for this group, because:
                     * - the query does cannot check all cases
                     * - the suggestion should disappear after registering
                     */
                    const organization = memberManager.family.getOrganization(group.organizationId);
                    if (!organization) {
                        console.error(`Could not find organization with id ${group.organizationId} for group with id ${group.id}`);
                        continue;
                    }
                    const canSomeMemberRegister = memberManager.family.members.some((member) => {
                        if (member.canRegister(group, organization) || member.canRegisterForWaitingList(group, organization)) {
                            return true;
                        }

                        return false;
                    });

                    if (!canSomeMemberRegister) {
                        continue;
                    }
                }
                else if (!event.webshopId) {
                    // event should have webshop or group
                    continue;
                }

                const groupText = getGroupDescriptionForEvent(event, memberManager.family.platform);
                const dateText = Formatter.date(event.startDate);
                const description = groupText ? $t('{dateText}, voor {groups}', { dateText, groups: groupText }) : dateText;

                arr.push({
                    leftComponent: EventIcon,
                    leftProps: { event },
                    title: $t('Schrijf in voor {event}', { event: event.name }),
                    description,
                    action: () => {
                        openEvent(event).catch(console.error);
                    },
                });
            }

            return arr;
        }),
        loading: computed(() => {
            return outstandingBalance.value === null || featuredEvents.value === null;
        }),
        errorBox: computed(() => {
            return errors.errorBox;
        }),
    };
}

function getGroupDescriptionForEvent(event: Event, platform: Platform) {
    const prefixes: string[] = [];

    if (event.meta.defaultAgeGroupIds !== null) {
        for (const ageGroupId of event.meta.defaultAgeGroupIds) {
            const ageGroup = platform.config.defaultAgeGroups.find(g => g.id === ageGroupId);
            if (ageGroup) {
                prefixes.push(ageGroup.name);
            }
        }
    }

    if (event.meta.groups !== null) {
        for (const group of event.meta.groups) {
            prefixes.push(group.name);
        }
    }

    if (prefixes.length === 0) {
        return null;
    }

    return Formatter.joinLast(prefixes, ', ', ' ' + $t(`c1843768-2bf4-42f2-baa4-42f49028463d`) + ' ');
}

export async function getFeaturedEventsForFamily({ context, family, owner }: { context: SessionContext; family: PlatformFamily; owner?: object }) {
    if (family.members.length === 0) {
        return [];
    }

    function createFilter(family: PlatformFamily): StamhoofdFilter | null {
        const groupIds = new Set<string>();
        const defaultGroupIds = new Set<string>();
        const organizationIds = new Set<string>();
        const ages = new Set<number>();
        const periodIds = getActivePeriodIds(null, null, family.platform);
        for (const org of family.organizations) {
            const ids = getActivePeriodIds(null, org);
            for (const id of ids) {
                periodIds.add(id);
            }
        }
        const periodIdsArray = [...periodIds];

        for (const organization of family.organizations) {
            organizationIds.add(organization.id);
        }

        for (const member of family.members) {
            for (const group of member.filterGroups({ types: [GroupType.Membership], periodIds: periodIdsArray, includePending: true })) {
                groupIds.add(group.id);
                if (group.defaultAgeGroupId) {
                    defaultGroupIds.add(group.defaultAgeGroupId);
                }
                organizationIds.add(group.organizationId);

                if (member.patchedMember.details.age) {
                    const d = member.patchedMember.details.trackedAgeForYear(new Date().getFullYear());
                    if (d !== null) {
                        ages.add(d);
                    }

                    const d2 = member.patchedMember.details.trackedAgeForYear(new Date(Date.now() + 1000 * 60 * 60 * 24 * 31 * 6).getFullYear());
                    if (d2 !== null) {
                        ages.add(d2);
                    }
                }
            }
        }

        let ageFilter: StamhoofdFilter | null = null;

        if (ages.size > 0) {
            ageFilter = {
                $or: [...ages].sort().map(age => ({
                    $and: [
                        {
                            $or: [
                                { minAge: { $lte: age } },
                            ],
                        },
                        {
                            $or: [
                                { maxAge: null },
                                { maxAge: { $gte: age } },
                            ],
                        },
                    ],
                })),
            };
        }

        const uniqueOrganizationIds = [...organizationIds];
        if (uniqueOrganizationIds.length === 0) {
            // should not happen
            console.error('Cannot create filter to get suggested activities because no organizations are found.');
            return null;
        }

        // cannot use $now because this is a json property and not a column
        const currentTime = (new Date()).getTime();

        // max 1 year into the future
        const maxStartDate = new Date(currentTime);
        maxStartDate.setFullYear(maxStartDate.getFullYear() + 1);

        const filter: StamhoofdFilter = [
            {
                'organizationId': {
                    // automatically converts to $eq if size is 1?
                    $in: uniqueOrganizationIds,
                },
                // with group or webshop
                '$or': [
                    {
                    // this filter will probably filter away most results fastest
                        groupId: {
                            $neq: null,
                            // filter on open groups later (is more expensive)
                        },
                    },
                    {
                        webshopId: {
                            $neq: null,
                            // filter on open webshops later (is more expensive)
                        },
                    },
                ],
                // in future
                'startDate': {
                    $gt: { $: '$now' },
                    $lte: maxStartDate,
                },
                // visible
                'meta.visible': true,
                'groupIds': {
                    $in: [null, ...groupIds.values()],
                },
                'defaultAgeGroupIds': {
                    $in: [null, ...defaultGroupIds.values()],
                },
            },
            ...(ageFilter ? [ageFilter] : []),
            {
            // add this filter last because it is more expensive (exists filter)
                $or: [
                    {
                    // this means groupId is not null (see previous filter)
                        webshopId: {
                            $eq: null,
                        },
                    }, {
                        webshop: {
                            status: WebshopStatus.Open,
                            $and: [
                                {
                                    $or: [
                                        { openAt: null },
                                        { openAt: { $lte: currentTime } },
                                    ],
                                },
                                {
                                    $or: [
                                        { availableUntil: null },
                                        { availableUntil: { $gt: currentTime } },
                                    ],
                                },
                            ],

                        },

                    },
                ],
            },
            {
                $or: [
                    {
                    // this means webshopId is not null (see previous filter)
                        groupId: {
                            $eq: null,
                        },
                    },
                    {
                        group: {
                            status: GroupStatus.Open,
                            $and: [
                                {
                                    $or: [
                                        { registrationStartDate: null },
                                        { registrationStartDate: { $lte: currentTime } },
                                        { preRegistrationsDate: { $lte: currentTime } },
                                    ],
                                },
                                {
                                    $or: [
                                        { registrationEndDate: null },
                                        { registrationEndDate: { $gt: currentTime } },
                                    ],
                                },
                            ],
                        },
                    },
                ],
            },
        ];

        return filter;
    }

    const filter = createFilter(family);
    if (filter === null) {
        return [];
    }

    const query = new LimitedFilteredRequest({
        filter,
        limit: 5,
        sort: [
            { key: 'startDate', order: SortItemDirection.ASC },
            { key: 'id', order: SortItemDirection.ASC },
        ],
    });

    try {
        const response = await context.authenticatedServer.request({
            method: 'GET',
            path: '/events',
            decoder: new PaginatedResponseDecoder(new ArrayDecoder(Event as Decoder<Event>), LimitedFilteredRequest as Decoder<LimitedFilteredRequest>),
            query,
            shouldRetry: false,
            owner,
            timeout: 30 * 1000,
        });

        return response.data.results;
    }
    catch (e) {
        console.error('Failed to fetch suggested activities, filter: ', JSON.stringify(filter));
        console.error(e);
    }

    return [];
}
