import type { Decoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder } from '@simonbackx/simple-encoding';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import type { MemberManager } from '@stamhoofd/networking/MemberManager';
import { useMemberManager } from '@stamhoofd/networking/MemberManager';
import type { SessionContext } from '@stamhoofd/networking/SessionContext';
import type { Group, Organization, PlatformFamily, PlatformMember, StamhoofdFilter } from '@stamhoofd/structures';
import { Event, getActivePeriodIds, GroupStatus, GroupType, LimitedFilteredRequest, PaginatedResponseDecoder, PayableBalanceCollection, SortItemDirection, WebshopStatus } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import type { Ref } from 'vue';
import { computed, onActivated, onMounted, ref } from 'vue';
import { ErrorBox } from '../../errors/ErrorBox';
import { useErrors } from '../../errors/useErrors';
import { GlobalEventBus } from '../../EventBus';
import { useContext, useUser } from '../../hooks';
import { useChooseGroupForMember, useEditMember } from '../../members';
import { MemberStepManager } from '../../members/classes/MemberStepManager';
import { getAllMemberSteps } from '../../members/classes/steps';
import { useNavigationActions } from '../../types/NavigationActions';
import type { QuickAction, QuickActions } from '../classes/QuickActions';

import { ComponentWithProperties, NavigationController, useNavigate, useShow } from '@simonbackx/vue-app-navigation';
import cartSvg from '@stamhoofd/assets/images/illustrations/cart.svg';
import emailWarningSvg from '@stamhoofd/assets/images/illustrations/email-warning.svg';
import missingDataSvg from '@stamhoofd/assets/images/illustrations/missing-data.svg';
import outstandingAmountSvg from '@stamhoofd/assets/images/illustrations/outstanding-amount.svg';
import { EventView } from '../../events';
import EventIcon from '../../events/components/EventIcon.vue';
import { useVisibilityChange } from '../../hooks/useVisibilityChange.js';
import RegistrationInvitationIcon from '../RegistrationInvitationIcon.vue';

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
    const chooseGroupForMember = useChooseGroupForMember();

    async function openCart() {
        await GlobalEventBus.sendEvent('selectTabById', 'cart');
    }

    async function fillInMemberMissingData(member: PlatformMember) {
        const steps = getAllMemberSteps(member, null, { outdatedTime: null });
        const manager = new MemberStepManager(context.value, member, steps, async (navigate) => {
            await navigate.dismiss({ force: true });
        }, { action: 'present', modalDisplayStyle: 'popup' });

        await manager.saveHandler(null, navigate);
    }

    async function checkAllMemberData(member: PlatformMember) {
        await editMember(member, { title: $t(`%uC`) });
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
                    title: $t(`%hv`),
                    description: checkout.value.cart.price > 0 ? $t(`%hw`) : $t(`%hx`),
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
                    title: $t(`%hy`) + ' ' + organizationStatus.organization.name,
                    description: $t(`%hz`) + ' ' + Formatter.price(open) + ' ' + $t(`%i0`) + ' ' + organizationStatus.organization.name + '',
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
                    title: $t(`%14A`, { member: member.member.patchedMember.firstName }),
                    description: $t(`%14B`, { member: member.member.patchedMember.firstName }),
                    action: () => fillInMemberMissingData(member.member),
                });
            }

            for (const member of membersWithMissingEmail.value) {
                // Het e-mailadres van dit account is niet toegevoegd bij
                arr.push({
                    illustration: emailWarningSvg,
                    title: $t(`%14C`, { member: member.patchedMember.firstName }),
                    description: $t(`%14I`, {
                        email: user.value?.email ?? '',
                        member: member.patchedMember.details.firstName,
                    }),
                    action: () => checkAllMemberData(member),
                });
            }

            // todo: sort on createdAt?
            for (const member of memberManager.family.members) {
                
                const invitations = member.member.registrationInvitations.filter(i => !i.group.isClosed && i.group.type === GroupType.Membership);
                if (invitations.length === 0) {
                    continue;
                }

                invitations.sort((a, b) => a.group.name.toString().localeCompare(b.group.name.toString()));

                const groupsText = Formatter.joinLast(invitations.map(i => i.group.name.toString()), ', ', ' ' + $t(`%M1`) + ' ');

                let groupForIcon: Group | undefined = undefined;
                let defaultOrganization: Organization | undefined = undefined;

                // find the group to show in the icon
                for (const invitation of invitations) {
                    const organization = memberManager.family.getOrganization(invitation.organizationId);
                    if (organization) {
                        defaultOrganization = organization;

                        const group = organization.period.groups.find(g => g.id === invitation.group.id);
                        if (group) {
                            groupForIcon = group;
                            if (group.squareImage !== null) {
                                // stop if a group with an image is found
                                break;
                            }
                        }
                    }
                }

                if (!groupForIcon) {
                    continue;
                }

                arr.push({
                    leftComponent: RegistrationInvitationIcon,
                    leftProps: {
                        group: groupForIcon,
                        organization: defaultOrganization,
                    },
                    prefix: $t('Uitnodiging'),
                    title: $t('Schrijf {firstName} in voor {groups}', {firstName: member.member.firstName, groups: groupsText}),
                    description: $t('Je kan {firstName} nu inschrijven voor {groups}.', {firstName: member.member.firstName, groups: groupsText}),
                    action: () => {
                        chooseGroupForMember({member, defaultOrganization, displayOptions: {action: 'present', modalDisplayStyle: 'popup'}}).catch(console.error);
                    },
                });
            }

            if (featuredEvents.value) {
                const maxSuggestions = 3 - arr.length;
                let suggestionCount = 0;

                // first get the events where members are invited for
                const {invited, notInvited} = getEventsWhereInvited({events: featuredEvents.value, memberManager});

                // first create actions for events where members are invited
                for (const event of invited) {
                    if (!event.group) {
                        // should not happen
                        continue;
                    }
                    
                    const description = Formatter.capitalizeFirstLetter(Formatter.dateRange(event.startDate, event.endDate));
                    suggestionCount += 1;
                    arr.push({
                        leftComponent: RegistrationInvitationIcon,
                        leftProps: { event, group: event.group },
                        prefix: $t('Uitnodiging'),
                        title: $t('%1Mp', { event: event.name }),
                        description,
                        action: () => openEvent({event, show}),
                    });
                }

                // add extra actions for left over events if limit is not reached
                for (const event of notInvited) {
                    if (suggestionCount >= maxSuggestions) {
                        break;
                    }

                    const quickAction = createQuickActionForEvent({event, memberManager, show});
                    if (quickAction === null) {
                        continue;
                    }

                    suggestionCount += 1;
                    arr.push(quickAction);
                }
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

function getEventsWhereInvited({events, memberManager}: {events: Event[], memberManager: MemberManager}): {notInvited: Event[], invited: Event[]} {
    const groupInvites = new Set(memberManager.family.members.flatMap(m => m.member.registrationInvitations.map(r => r.group.id)));

    const invited: Event[] = [];
    const notInvited: Event[] = [];

    for (const event of events) {
        if (event.group && groupInvites.has(event.group.id)) {
            invited.push(event);
        } else {
            notInvited.push(event);
        }
    }

    return {
        invited,
        notInvited
    }
}

function openEvent({event, show}: {event: Event, show: ReturnType<typeof useShow>} ) {
    const component = new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(EventView, {
            event,
        }),
    });

    show({
        components: [component],
    }).catch(console.error);
}

function createQuickActionForEvent({event, memberManager, show}: {event: Event, memberManager: MemberManager, show: ReturnType<typeof useShow>} ): QuickAction | null {
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
            return null;
        }
        const canSomeMemberRegister = memberManager.family.members.some((member) => {
            if (member.canRegister(group, organization) || member.canRegisterForWaitingList(group, organization)) {
                return true;
            }

            return false;
        });

        if (!canSomeMemberRegister) {
            return null;
        }
    }
    else if (!event.webshopId) {
        // event should have webshop or group
        return null;
    }

    const description = Formatter.capitalizeFirstLetter(Formatter.dateRange(event.startDate, event.endDate));

    return {
        leftComponent: EventIcon,
        leftProps: { event },
        prefix: $t('Aankomende activiteit'),
        title: event.webshopId ? event.name : $t('%1Mp', { event: event.name }),
        description,
        action: () => openEvent({event, show}),
    };
}

export async function getFeaturedEventsForFamily({ context, family, owner }: { context: SessionContext; family: PlatformFamily; owner?: object }) {
    if (family.members.length === 0) {
        return [];
    }

    function createFilter(family: PlatformFamily): StamhoofdFilter | null {
        // filter on groups that can register for this event
        const groupIds = new Set<string>();
        const defaultGroupIds = new Set<string>();
        const organizationIds = new Set<string>();
        const ages = new Set<number>();
        // filter on the group that is linked to this event
        const eventGroupIds = new Set<string>();
        const periodIds = getActivePeriodIds(null, null, family.platform);
        for (const org of family.organizations) {
            const ids = getActivePeriodIds(null, org);
            for (const id of ids) {
                periodIds.add(id);
            }
        }
        const periodIdsArray = [...periodIds];

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

            // also add the events this member is invited for
            for (const invitation of member.member.registrationInvitations) {
                if (invitation.group.isClosed) {
                    continue;
                }

                eventGroupIds.add(invitation.group.id);
                organizationIds.add(invitation.organizationId);
            }
        }

        // for userMode organization if no registrations
        if (organizationIds.size === 0) {
            for (const organization of family.organizations) {
                organizationIds.add(organization.id);
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

        let eventGroupsFilter: StamhoofdFilter | null = null;
        if (eventGroupIds.size > 0) {
            eventGroupsFilter = {
                groupId: {
                    $in: [...eventGroupIds],
                }
            }
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
            },
            {
                $or: [
                    {
                        $and: [
                            {
                                'groupIds': {
                                    $in: [null, ...groupIds.values()],
                                },
                                'defaultAgeGroupIds': {
                                    $in: [null, ...defaultGroupIds.values()],
                                }
                            },
                            ...(ageFilter ? [ageFilter] : []),
                        ]
                    },
                    ...eventGroupsFilter ? [eventGroupsFilter] : []
                ]
            },
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
