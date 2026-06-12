<template>
    <LoadingViewTransition>
        <div v-if="invitationsCount !== null" id="webshop-overview" class="st-view background">
            <STNavigationBar :title="title" />

            <main class="center">
                <h1 class="style-navigation-title with-icons">
                    <span class="block-icon">
                        <GroupAvatar :group="group" class="inline" :with-aside="false" />
                    </span>

                    <div>
                        <span>
                            <span>{{ title }}</span>
                            <span v-if="group.settings.period" class="title-suffix">
                                {{ group.settings.period.nameShort }}
                            </span>
                        </span>

                        <p class="tags-without-background">
                            <GroupTag :group="group" />
                        </p>
                    </div>

                    <span v-if="!isPublic" v-tooltip="$t('%LU')" :class="'icon eye-off tiny gray'" />
                </h1>

                <BillingWarningBox filter-types="members" class="data-table-prefix" />

                <p v-if="canCreateEvent" class="info-box">
                    {{ $t('%1NE') }}
                    <span class="button text inherit-color" @click="convertToEvent">
                        <span class="icon calendar" />
                        <span>{{ $t('%1NF') }}</span>
                    </span>
                </p>
                <p v-if="isLocked" class="warning-box">
                    {{ $t('%8Q') }}
                </p>

                <STList class="illustration-list">
                    <STListItem v-if="group.type !== GroupType.WaitingList" :selectable="true" class="left-center right-stack" @click="navigate(Routes.Members)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/group.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('%LX') }}
                        </h2>
                        <p class="style-description-small">
                            {{ $t('%LY') }}
                        </p>
                        <template #right>
                            <span v-if="group.getMemberCount() !== null" class="style-description-small">{{ formatInteger(group.getMemberCount()!) }}</span>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                    <STListItem v-else :selectable="true" class="left-center right-stack" @click="navigate(Routes.Members)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/clock.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('Leden op deze wachtlijst') }}
                        </h2>
                        <p class="style-description-small">
                            {{ $t('Bekijk, beheer, exporteer of e-mail leden op deze wachtlijst') }}
                        </p>
                        <template #right>
                            <span v-if="group.getMemberCount() !== null" class="style-description-small">{{ formatInteger(group.getMemberCount()!) }}</span>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem v-if="group.waitingList && auth.canAccessGroup(group.waitingList, PermissionLevel.Read)" :selectable="true" class="left-center right-stack" @click="navigate(Routes.WaitingList)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/clock.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('%1IQ') }}
                        </h2>
                        <p class="style-description-small">
                            {{ $t('%LZ') }}
                        </p>

                        <p class="tags-without-background">
                            <GroupTag :group="group.waitingList" />
                        </p>

                        <template #right>
                            <span v-if="group.waitingList.getMemberCount() !== null" class="style-description-small">{{ formatInteger(group.waitingList.getMemberCount()!) }}</span>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem v-if="invitationsCount > 0" :selectable="true" class="left-center right-stack" @click="navigate(Routes.Invitations)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/email.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('%1TY') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('%1QH', {group: group.settings.name.toString()}) }}
                        </p>
                        <template #right>
                            <span class="style-description-small">{{ formatInteger(invitationsCount) }}</span>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem v-for="responsibility of linkedResponsibilities" :key="responsibility.id" :selectable="true" class="left-center right-stack" @click="openResponsibility(responsibility)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/responsibility.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ responsibility.name }} van {{ group.settings.name }}
                        </h2>
                        <p class="style-description">
                            {{ $t('%La') }}
                        </p>

                        <template #right>
                            <MemberCountSpan :filter="getResponsibilityFilter(responsibility)" class="style-description-small" />
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
                
                <template v-if="hasFullPermissions">
                    <hr><h2>{{ $t('%xU') }}</h2>

                    <STList class="illustration-list">
                        <STListItem :selectable="true" class="left-center" @click="editGeneral(true)">
                            <template #left>
                                <img src="@stamhoofd/assets/images/illustrations/flag.svg">
                            </template>
                            <h2 class="style-title-list">
                                {{ $t('%Lb') }}
                            </h2>
                            <p class="style-description-small">
                                {{ $t('%Lc') }}
                            </p>
                            <template #right>
                                <span class="icon arrow-right-small gray" />
                            </template>
                        </STListItem>

                        <STListItem :selectable="true" class="left-center" @click="editPermissions(true)">
                            <template #left>
                                <img src="@stamhoofd/assets/images/illustrations/lock.svg">
                            </template>
                            <h2 class="style-title-list">
                                {{ $t('%Ld') }}
                            </h2>
                            <p class="style-description-small">
                                {{ $t('%Le') }}
                            </p>
                            <template #right>
                                <span class="icon arrow-right-small gray" />
                            </template>
                        </STListItem>

                        <STListItem :selectable="true" class="left-center" @click="editPage(true)">
                            <template #left>
                                <img src="@stamhoofd/assets/images/illustrations/palette.svg">
                            </template>
                            <h2 class="style-title-list">
                                {{ $t("%Ln") }}
                            </h2>
                            <p class="style-description-small">
                                {{ $t('%Lf') }}
                            </p>
                            <template #right>
                                <span class="icon arrow-right-small gray" />
                            </template>
                        </STListItem>

                        <STListItem data-testid="group-email-templates-button" :selectable="true" class="left-center" @click="editEmails(true)">
                            <template #left>
                                <img src="@stamhoofd/assets/images/illustrations/email-template.svg">
                            </template>
                            <h2 class="style-title-list">
                                {{ $t('%1DD') }}
                            </h2>
                            <p class="style-description-small">
                                {{ $t('%Lg') }}
                            </p>
                            <template #right>
                                <span class="icon arrow-right-small gray" />
                            </template>
                        </STListItem>
                    </STList>

                    <hr>
                    <h2>{{ $t('%16X') }}</h2>

                    <STList>
                        <template v-if="!isDifferentPeriod">
                            <STListItem v-if="!isArchive && !isOpen" :selectable="true" class="left-center" @click="openGroup()">
                                <template #left>
                                    <IconContainer icon="unlock" class="success" />
                                </template>
                                <h2 class="style-title-list">
                                    {{ $t('%Lh') }}
                                </h2>
                                <p class="style-description-small">
                                    {{ $t('%Li') }}
                                </p>

                                <template #right>
                                    <span class="icon arrow-right-small gray" />
                                </template>
                            </STListItem>

                            <STListItem v-if="!isArchive && isOpen" class="left-center" :selectable="true" @click="closeGroup()">
                                <template #left>
                                    <IconContainer icon="lock" class="error" />
                                </template>

                                <h2 class="style-title-list">
                                    {{ $t('%Lj') }}
                                </h2>
                                <p class="style-description-small">
                                    {{ $t('%1QD') }}
                                </p>
                                <template #right>
                                    <span class="icon arrow-right-small gray" />
                                </template>
                            </STListItem>
                        </template>

                        <STListItem :selectable="true" class="left-center" @click="deleteGroup()">
                            <template #left>
                                <IconContainer icon="trash" class="error" />
                            </template>

                            <h2 class="style-title-list">
                                {{ $t('%Ll') }}
                            </h2>
                            <p class="style-description-small">
                                {{ $t('%Lm') }}
                            </p>
                            <template #right>
                                <span class="icon arrow-right-small gray" />
                            </template>
                        </STListItem>
                    </STList>
                </template>
            </main>
        </div>
    </LoadingViewTransition>
</template>

<script lang="ts" setup>
import type { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder, PatchableArray } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, defineRoute, defineRoutes, NavigationController, useNavigate, useNavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import EditResourceRolesView from '@stamhoofd/components/admins/EditResourceRolesView.vue';
import PromiseView from '@stamhoofd/components/containers/PromiseView.vue';
import EditEmailTemplatesView from '@stamhoofd/components/email/EditEmailTemplatesView.vue';
import { GlobalEventBus } from '@stamhoofd/components/EventBus.ts';
import EditGroupView from '@stamhoofd/components/groups/EditGroupView.vue';
import { useAuth } from '@stamhoofd/components/hooks/useAuth.ts';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { useFeatureFlag } from '@stamhoofd/components/hooks/useFeatureFlag.ts';
import { useOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import { usePlatform } from '@stamhoofd/components/hooks/usePlatform.ts';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import MemberCountSpan from '@stamhoofd/components/members/components/MemberCountSpan.vue';
import MembersTableView from '@stamhoofd/components/members/MembersTableView.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import RegistrationsTableView from '@stamhoofd/components/registrations/RegistrationsTableView.vue';
import { useGetGroupsById } from '@stamhoofd/networking/hooks/useGetGroups';
import { useGetPeriods } from '@stamhoofd/networking/hooks/useGetPeriods';
import { usePatchOrganizationPeriod } from '@stamhoofd/networking/hooks/usePatchOrganizationPeriod';
import { useOrganizationManager } from '@stamhoofd/networking/OrganizationManager';
import type { Group, MemberResponsibility, Organization, OrganizationRegistrationPeriod, RegistrationPeriod, TranslatedString } from '@stamhoofd/structures';
import { EmailTemplateType, Event, EventLocation, EventMeta, GroupStatus, GroupType, NamedObject, PermissionLevel, PermissionsResourceType, RichText } from '@stamhoofd/structures';

import { SimpleError } from '@simonbackx/simple-errors';
import { countAll, RegistrationInvitationsTableView, useRegistrationInvitationEventListener } from '@stamhoofd/components';
import LoadingViewTransition from '@stamhoofd/components/containers/LoadingViewTransition.vue';
import { useRegistrationInvitationsObjectFetcher } from '@stamhoofd/components/fetchers/useRegistrationInvitationsObjectFetcher';
import GroupAvatar from '@stamhoofd/components/GroupAvatar.vue';
import IconContainer from '@stamhoofd/components/icons/IconContainer.vue';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref } from 'vue';
import { useGroupActions } from '../../members/useGroupActions';
import BillingWarningBox from '../settings/packages/BillingWarningBox.vue';
import EditGroupPageView from './edit/EditGroupPageView.vue';
import GroupTag from '@stamhoofd/components/auth/components/GroupTag.vue';

const props = defineProps<{
    group: Group;
    period: OrganizationRegistrationPeriod;
}>();

const isPublic = computed(() => props.group.isPublic(props.period.availableCategories));
const title = computed(() => props.group.settings.name.toString());
const isArchive = computed(() => props.group.status === GroupStatus.Archived);
const isOpen = computed(() => !props.group.closed);
const auth = useAuth();
const hasFullPermissions = computed(() => auth.canAccessGroup(props.group, PermissionLevel.Full));
const organizationManager = useOrganizationManager();
const organization = useOrganization();
const navigationController = useNavigationController();
const present = usePresent();
const isLocked = computed(() => props.period.period.locked);
const platform = usePlatform();
const patchOrganizationPeriod = usePatchOrganizationPeriod();
const context = useContext();
const getGroupsById = useGetGroupsById();
const getPeriods = useGetPeriods();
const featureFlag = useFeatureFlag();
const isDifferentPeriod = computed(() => organization.value && organization.value.period.period.id !== props.group.periodId);

const invitationsCount = ref<number | null>(null);

// should be reactive because this can change
const canCreateEvent = computed(() => checkCanCreateEvent(props.group));

enum Routes {
    Registrations = 'inschrijvingen',
    Members = 'Members',
    WaitingList = 'WaitingList',
    Responsibility = 'Responsibility',
    Invitations = 'Invitations',
}

defineRoutes([{
    url: 'inschrijvingen',
    name: Routes.Members,
    component: RegistrationsTableView,
    defaultProperties: () => {
        return {
            group: props.group,
            organization: organization.value,
        };
    },
},
{
    url: 'uitnodigingen',
    name: Routes.Invitations,
    component: RegistrationInvitationsTableView,
    defaultProperties: () => {
        return {
            group: props.group,
            estimatedRows: invitationsCount.value,
            updateTotal: (total: number | null) => {
                if (total !== null) {
                    invitationsCount.value = total;
                }
            },
        };
    },
},
{
    url: 'wachtlijst',
    name: Routes.WaitingList,
    component: 'self',
    defaultProperties: () => {
        if (!props.group.waitingList) {
            throw new Error('No waiting list');
        }
        return {
            group: props.group.waitingList,
            period: props.period,
        };
    },
},
]);

defineRoute({
    url: '/r/@slug',
    name: Routes.Responsibility,
    params: {
        slug: String,
    },
    component: MembersTableView,
    paramsToProps(params) {
        const responsibility = linkedResponsibilities.value.find(r => Formatter.slug(r.name) === params.slug);

        if (!responsibility) {
            throw new Error('Responsibility not found');
        }

        return {
            responsibility,
            customTitle: responsibility.name + ' (' + props.group.settings.name + ')',
            customFilter: getResponsibilityFilter(responsibility),
        };
    },
    propsToParams(props) {
        return {
            params: {
                slug: Formatter.slug((props.responsibility as MemberResponsibility).name as string),
            },
        };
    },
});

const navigate = useNavigate();
const linkedResponsibilities = computed(() => {
    if (props.group.defaultAgeGroupId === null) {
        return [];
    }

    if (!auth.hasFullAccess()) {
        return [];
    }

    const id = props.group.defaultAgeGroupId;
    return platform.value.config.responsibilities.filter(r => r.defaultAgeGroupIds !== null && r.defaultAgeGroupIds.includes(id) && (r.organizationTagIds === null || organization.value?.meta.matchTags(r.organizationTagIds)));
});

function getResponsibilityFilter(responsibility: MemberResponsibility) {
    return {
        responsibilities: {
            $elemMatch: {
                responsibilityId: responsibility.id,
                group: {
                    id: props.group.id,
                },
                endDate: null,
            },
        },
    };
}

async function openResponsibility(responsibility: MemberResponsibility) {
    await navigate(Routes.Responsibility, {
        params: {
            slug: Formatter.slug(responsibility.name),
        },
    });
}

async function displayEditComponent(component: any, animated = true) {
    const displayedComponent = new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(PromiseView, {
            promise: async () => {
                try {
                    // Make sure we have an up to date group
                    await organizationManager.value.forceUpdate();
                    return new ComponentWithProperties(component, {
                        group: props.group,
                        period: props.period,
                        organization: organization.value,
                        iswNew: false,
                        saveHandler: async (patch: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => {
                            patch.id = props.period.id;
                            await patchOrganizationPeriod(props.period, patch);
                        },
                    });
                } catch (e) {
                    Toast.fromError(e).show();
                    throw e;
                }
            },
        }),
    });

    await present({
        animated,
        adjustHistory: animated,
        modalDisplayStyle: 'popup',
        components: [
            displayedComponent,
        ],
    });
}

async function editGeneral(animated = true) {
    const displayedComponent = new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(PromiseView, {
            promise: async () => {
                try {
                    // Make sure we have an up to date group
                    await organizationManager.value.forceUpdate();
                    return new ComponentWithProperties(EditGroupView, {
                        period: props.period,
                        groupId: props.group.id,
                        isNew: false,
                        saveHandler: async (patch: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => {
                            await patchOrganizationPeriod(props.period, patch);
                        },
                    });
                } catch (e) {
                    Toast.fromError(e).show();
                    throw e;
                }
            },
        }),
    });

    await present({
        animated,
        adjustHistory: animated,
        modalDisplayStyle: 'popup',
        components: [
            displayedComponent,
        ],
    });
}

async function editPermissions(animated = true) {
    await present({
        animated,
        adjustHistory: animated,
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditResourceRolesView, {
                description: $t('%1Dp'),
                resource: {
                    id: props.group.id,
                    name: props.group.settings.name.toString(),
                    type: PermissionsResourceType.Groups,
                },
                configurableAccessRights: [],
            }),
        ],
    });
}

async function editPage(animated = true) {
    await displayEditComponent(EditGroupPageView, animated);
}

async function editEmails(animated = true) {
    await present({
        components: [
            new ComponentWithProperties(EditEmailTemplatesView, {
                groups: props.group.waitingList ? [props.group, props.group.waitingList] : [props.group],
                allowEditGenerated: false,
                types: [
                    EmailTemplateType.RegistrationConfirmation,
                ],
            }),
        ],
        modalDisplayStyle: 'popup',
        animated,
    });
}

const groupActions = useGroupActions()(props);

async function openGroup() {
    try {
        await groupActions.openGroup();
    } catch (e) {
        Toast.fromError(e).show();
    }
}

async function closeGroup() {
    try {
        await groupActions.closeGroup();
    } catch (e) {
        Toast.fromError(e).show();
    }
}

async function deleteGroup() {
    try {
        if (await groupActions.deleteGroup()) {
            await navigationController.value?.pop({ force: true });
        }
    } catch (e) {
        Toast.fromError(e).show();
    }
}

function checkCanCreateEvent(group: Group) {
    // not possible for userMode platform
    if (STAMHOOFD.userMode !== 'organization'
        || (!organization.value)) {
        return false;
    }

    // not possible if group is in the past
    if (group.settings.endDate.getTime() < (new Date()).getTime()) {
        return false;
    }

    // not possible if end date is before start date (will fail in backend otherwise)
    if (group.settings.endDate < group.settings.startDate) {
        return false;
    }

    function isShorterThanMonth(group: Group) {
        const diffMs = group.settings.endDate.getTime() - group.settings.startDate.getTime();
        const msPerDay = 24 * 60 * 60 * 1000;
        const diffDays = diffMs / msPerDay;

        return diffDays < 30;
    }

    if (!isShorterThanMonth(group)) {
        return false;
    }

    if (// or if no event types (cannot create an event without types, activity tab will also not be visible)
        getAllowedEventTypes().length === 0
        // or if disabled
        || featureFlag('disable-events')) {
        return false;
    }

    return true;
}

async function convertToEvent() {
    if (!organization.value) {
        console.error(`Cannot create an event witout an organization.`);
        return;
    }

    if (!await CenteredMessage.confirm($t(`%1NL`), $t('%1NG'), $t(`%1NM`))) {
        return;
    }

    const toast = new Toast($t('%1NH'), 'spinner').show();

    try {
        const event = await createEventFromGroup(props.group, organization.value);
        // set the created event
        await saveEvent(event);
    } catch (e) {
        console.error(e);
        Toast.error($t('%1NI')).show();
        return;
    } finally {
        toast.hide();
    }

    Toast.success($t('%1NJ')).show();

    // navigate to event
    await GlobalEventBus.sendEvent('selectTabById', 'events');

    // remove group from period
    organization.value.period.groups = organization.value.period.groups.filter(g => g.id !== props.group.id);
}

async function saveEvent(event: Event): Promise<Event> {
    const arr = new PatchableArray() as PatchableArrayAutoEncoder<Event>;
    arr.addPut(event);

    const response = await context.value.authenticatedServer.request({
        method: 'PATCH',
        path: '/events',
        body: arr,
        decoder: new ArrayDecoder(Event as Decoder<Event>),
    });

    return response.data[0];
}

function getAllowedEventTypes() {
    if (!organization.value) {
        return [];
    }

    return organization.value.meta.eventTypes;
}

async function createEventFromGroup(group: Group, organization: Organization) {
    function descriptionToRichtText(description: TranslatedString) {
        const text = description.toString();
        const html = text.split('\n').map(split => `<p>${Formatter.escapeHtml(split)}</p>`).join('');

        return RichText.create({
            text,
            html,
        });
    }

    async function requireGroupIdsToNamedObjects(requireGroupIds: string[]): Promise<NamedObject[]> {
        // first try to find the group in the current period
        const groupsInPeriod = organization.period.groups;
        const foundGroups: { group: Group; period: RegistrationPeriod }[] = [];
        const missingGroupIds: string[] = [];

        const defaultPeriod = organization.period.period;
        for (const groupId of requireGroupIds) {
            const group = groupsInPeriod.find(g => g.id === groupId);
            if (group) {
                foundGroups.push({ group, period: defaultPeriod });
            } else {
                missingGroupIds.push(groupId);
            }
        }

        const allGroups = foundGroups;

        // next get the missing groups and periods from the server
        if (missingGroupIds.length > 0) {
            const missingGroups = await getGroupsById(missingGroupIds, true);

            // extra validation to make sure all groups are found
            for (const missingGroupId of missingGroupIds) {
                if (!missingGroups.find(g => g.id === missingGroupId)) {
                    throw new Error(`Could not find group with id ${missingGroupId}`);
                }
            }

            const missingPeriodIds = await getPeriods(missingGroups.map(g => g.periodId), true);

            for (const group of missingGroups) {
                const period = missingPeriodIds.find(p => p.id === group.periodId);
                if (!period) {
                    throw new Error('Could not find period for group, should not happen.');
                }

                allGroups.push({ group, period });
            }
        }

        return allGroups.map(({ group, period }) => {
            return NamedObject.create({
                id: group.id,
                name: group.settings.name.toString(),
                description: period.nameShort,
            });
        });
    }

    function getEventTypeId(groupName: string): string {
        const eventTypes = getAllowedEventTypes();
        if (eventTypes.length === 0) {
            throw new Error('Cannot create an event because no event types are configured on the platform.');
        }

        if (eventTypes.length === 1) {
            return eventTypes[0].id;
        }

        const formattedGroupName = groupName.toLowerCase();

        for (const eventType of eventTypes) {
            const formattedEventName = eventType.name.toLowerCase();
            if (formattedGroupName.includes(formattedEventName)) {
                return eventType.id;
            }
        }

        const eventType = eventTypes.find(e => e.isDefault) ?? eventTypes[0];
        return eventType.id;
    }

    const groupNamedObjects = await requireGroupIdsToNamedObjects(group.settings.requireGroupIds);

    const name = group.settings.name.toString();
    if (name.length < 2) {
        // will fail in the backend otherwise
        throw new SimpleError({
            code: 'group-name-too-short',
            message: 'Name should be at least 2 characters long',
            human: $t('%1NK'),
        });
    }

    return Event.create({
        organizationId: organization.id,
        name,
        typeId: getEventTypeId(name),
        startDate: group.settings.startDate,
        endDate: group.settings.endDate,
        meta: EventMeta.create({
            visible: true,
            description: descriptionToRichtText(group.settings.description),
            location: group.settings.location ? EventLocation.create({ name: group.settings.location }) : null,
            groups: groupNamedObjects.length === 0 ? undefined : groupNamedObjects,
            coverPhoto: group.settings.coverPhoto,
            minAge: group.settings.minAge,
            maxAge: group.settings.maxAge,
        }),
        group,
    });
}

const invitationsFetcher = useRegistrationInvitationsObjectFetcher({
    requiredFilter: {
        groupId: props.group.id,
    },
});

async function fetchInvitationCount() {
    try {
        invitationsCount.value = await countAll(invitationsFetcher);
    } catch (e) {
        console.error(e);
        invitationsCount.value = 0;
    }
}

fetchInvitationCount().catch(console.error);

useRegistrationInvitationEventListener('updated', async (value) => {
    // update the invitation count if invitations for this groups changed
    // do not fetch again if the change originated in the invitations table (prevent double fetch)
    if (value.origin !== 'invitations-table' && value.groupIds.has(props.group.id)) {
        fetchInvitationCount().catch(console.error);
    }
});
</script>
