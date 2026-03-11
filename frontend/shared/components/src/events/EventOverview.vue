<template>
    <ExternalOrganizationContainer :organization-id="event.organizationId" @update="setOrganization">
        <ExternalOrganizationContainer :organization-id="event.group?.organizationId ?? null" :organization-hint="eventOrganization" @update="setGroupOrganization">
            <div class="st-view event-overview">
                <STNavigationBar :title="title" />

                <main class="center">
                    <ImageComponent v-if="event.meta.coverPhoto" :image="event.meta.coverPhoto" :auto-height="true" class="style-cover-photo" />

                    <p class="style-title-prefix">
                        {{ levelPrefix }}
                    </p>
                    <h1 class="style-navigation-title">
                        {{ title }}
                    </h1>

                    <template v-if="event.meta.description.html">
                        <div class="description style-wysiwyg gray large" v-html="event.meta.description.html" />
                    </template>

                    <EventInfoTable :event="event">
                        <template v-if="event.group && (!organization || auth.canAccessGroup(event.group, undefined, groupOrganization) || event.group.settings.implicitlyAllowViewRegistrations)">
                            <STListItem :selectable="true" class="left-center right-stack" @click="$navigate(Routes.Registrations)">
                                <template #left>
                                    <span class="icon group" />
                                </template>

                                <h2 class="style-title-list">
                                    {{ $t('%LX') }}
                                </h2>
                                <p class="style-description">
                                    {{ $t('%LY') }}
                                </p>
                                <template #right>
                                    <span v-if="event.group.getMemberCount() !== null && canWriteEvent" class="style-description-small">{{ formatInteger(event.group.getMemberCount()!) }}</span>
                                    <RegistrationCountSpan v-else :filter="getCountFilter(event.group)" class="style-description-small" />
                                    <span class="icon arrow-right-small gray" />
                                </template>
                            </STListItem>

                            <STListItem v-if="event.group.waitingList && (!organization || auth.canAccessGroup(event.group.waitingList, undefined, groupOrganization) || event.group.waitingList.settings.implicitlyAllowViewRegistrations)" :selectable="true" class="left-center right-stack" @click="$navigate(Routes.WaitingList)">
                                <template #left>
                                    <span class="icon clock" />
                                </template>

                                <h2 class="style-title-list">
                                    {{ event.group.waitingList.settings.name }}
                                </h2>
                                <p class="style-description">
                                    {{ $t('%au') }}
                                </p>
                                <template #right>
                                    <span v-if="event.group.waitingList.getMemberCount() !== null && canWriteEvent" class="style-description-small">{{ formatInteger(event.group.waitingList.getMemberCount()!) }}</span>
                                    <RegistrationCountSpan v-else :filter="getCountFilter(event.group.waitingList)" class="style-description-small" />
                                    <span class="icon arrow-right-small gray" />
                                </template>
                            </STListItem>
                        </template>
                    </EventInfoTable>

                    <div v-if="canWriteEvent" class="container">
                        <hr><h2>
                            {{ $t('%xU') }}
                        </h2>

                        <STList class="illustration-list">
                            <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.Edit)">
                                <template #left>
                                    <img src="@stamhoofd/assets/images/illustrations/flag.svg">
                                </template>
                                <h2 class="style-title-list">
                                    {{ $t('%Lb') }}
                                </h2>
                                <p class="style-description">
                                    {{ $t('%av') }}
                                </p>
                                <template #right>
                                    <span class="icon arrow-right-small gray" />
                                </template>
                            </STListItem>

                            <STListItem v-if="event.group" :selectable="true" class="left-center" @click="$navigate(Routes.EditGroup)">
                                <template #left>
                                    <img src="@stamhoofd/assets/images/illustrations/list.svg">
                                </template>
                                <h2 class="style-title-list">
                                    {{ $t('%aw') }}
                                </h2>
                                <p class="style-description">
                                    {{ $t('%ax') }}
                                </p>
                                <template #right>
                                    <span class="icon arrow-right-small gray" />
                                </template>
                            </STListItem>

                            <STListItem v-if="event.group" :selectable="true" class="left-center" @click="$navigate(Routes.EditEmails)">
                                <template #left>
                                    <img src="@stamhoofd/assets/images/illustrations/email-template.svg">
                                </template>
                                <h2 class="style-title-list">
                                    {{ $t('%1DD') }}
                                </h2>
                                <p class="style-description">
                                    {{ $t('%ay') }}
                                </p>
                                <template #right>
                                    <span class="icon arrow-right-small gray" />
                                </template>
                            </STListItem>

                            <STListItem v-if="event.webshopId" :selectable="canEditWebshopHere" class="left-center right-stack" @click="canEditWebshopHere ? $navigate(Routes.Webshop) : null">
                                <template #left>
                                    <img src="@stamhoofd/assets/images/illustrations/cart.svg">
                                </template>
                                <h2 v-if="!webshop || webshop.meta.name === event.name" class="style-title-list">
                                    {{ $t('%1Ag') }}
                                </h2>
                                <h2 v-else class="style-title-list">
                                    {{ webshop.meta.name ?? $t('%Gr') }}
                                </h2>
                                <p v-if="canEditWebshopHere" class="style-description-small">
                                    {{ $t('%1Ah') }}
                                </p>
                                <p v-else-if="webshop" class="style-description-small">
                                    {{ $t('%1CC') }}
                                </p>
                                <p v-else class="style-description-small">
                                    {{ $t('%1CD') }}
                                </p>
                                <template #right>
                                    <button v-if="canWriteEvent" v-tooltip="$t('%1Ai')" class="button icon unlink" type="button" @click.stop="unlinkWebshop" />
                                    <span v-if="canEditWebshopHere" class="icon arrow-right-small gray" />
                                </template>
                            </STListItem>

                            <template v-if="eventOrganization">
                                <EventNotificationRow v-for="type of event.eventNotificationTypes" :key="type.id" class="container" :type="type" :event="event" :organization="eventOrganization" />
                            </template>
                        </STList>
                    </div>

                    <hr>
                    <h2>{{ $t('%16X') }}</h2>
                    <STList>
                        <STListItem v-if="!event.group && !event.webshopId && canWriteEvent" :selectable="true" class="left-center" @click="createGroup">
                            <template #left>
                                <IconContainer icon="group" class="success">
                                    <template #aside>
                                        <span class="icon success stroke small" />
                                    </template>
                                </IconContainer>
                            </template>
                            <h2 class="style-title-list">
                                {{ $t('%1Aj') }}
                            </h2>
                            <p class="style-description-small">
                                {{ $t('%16Z') }}
                            </p>
                            <template #right>
                                <span class="icon arrow-right-small gray" />
                            </template>
                        </STListItem>

                        <STListItem v-if="!event.group && !event.webshopId && canWriteEvent && $feature('event-webshops')" :selectable="true" class="left-center" @click="linkWebshop">
                            <template #left>
                                <IconContainer icon="basket" class="success">
                                    <template #aside>
                                        <span class="icon success stroke small" />
                                    </template>
                                </IconContainer>
                            </template>
                            <h2 class="style-title-list">
                                {{ $t('%1Ak') }}
                            </h2>
                            <p class="style-description-small">
                                {{ $t('%1Al') }}
                            </p>
                            <template #right>
                                <span class="icon arrow-right-small gray" />
                            </template>
                        </STListItem>

                        <STListItem v-if="event.group && auth.canRegisterMembersInGroup(event.group, groupOrganization)" :selectable="true" class="left-center" @click="addMembers">
                            <template #left>
                                <IconContainer icon="group">
                                    <template #aside>
                                        <span class="icon add small stroke" />
                                    </template>
                                </IconContainer>
                            </template>
                            <h2 class="style-title-list">
                                {{ $t('%b0') }}
                            </h2>
                            <p v-if="organization && event.organizationId === organization.id" class="style-description-small">
                                {{ $t('%BJ') }}
                            </p>
                            <p v-else-if="!event.group.settings.isFree" class="style-description-small">
                                {{ $t('%BK') }}
                            </p>
                            <p v-else class="style-description-small">
                                {{ $t('%BL') }}
                            </p>
                            <template #right>
                                <span class="icon arrow-right-small gray" />
                            </template>
                        </STListItem>

                        <STListItem v-if="canWriteEvent && onSaveDuplicate" :selectable="true" class="left-center" @click="duplicateEvent()">
                            <template #left>
                                <IconContainer icon="copy" />
                            </template>
                            <h2 class="style-title-list">
                                {{ $t('%1Ka') }}
                            </h2>
                            <p class="style-description">
                                {{ $t('%1Kb') }}
                            </p>
                            <template #right>
                                <span class="icon arrow-right-small gray" />
                            </template>
                        </STListItem>

                        <STListItem v-if="event.meta.visible" v-copyable="link" :selectable="true" class="left-center">
                            <template #left>
                                <IconContainer icon="link" />
                            </template>
                            <h2 class="style-title-list">
                                {{ $t('%az') }}
                            </h2>
                            <p class="style-description-small">
                                {{ $t("%7l") }}
                            </p>
                            <div class="split-inputs option">
                                <input class="input" :value="link" readonly>
                            </div>
                            <template #right>
                                <span class="icon arrow-right-small gray" />
                            </template>
                        </STListItem>
                    </STList>
                </main>
            </div>
        </ExternalOrganizationContainer>
    </ExternalOrganizationContainer>
</template>

<script setup lang="ts">
import { ArrayDecoder, AutoEncoderPatchType, Decoder, deepSetArray, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, defineRoutes, NavigationController, useNavigate, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { useFetchOrganizationPeriodForGroup, usePatchOrganizationPeriod, useRequestOwner } from '@stamhoofd/networking';
import { AccessRight, appToUri, EmailTemplate, EmailTemplateType, Event, Group, GroupSettings, GroupStatus, LimitedFilteredRequest, mergeFilters, Organization, OrganizationRegistrationPeriod, PrivateWebshop, TranslatedString, WebshopMetaData, WebshopPreview, WebshopStatus } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { ComponentOptions, computed, nextTick, onMounted, Ref, ref, watch } from 'vue';
import { LoadComponent, PromiseView } from '../containers';
import ExternalOrganizationContainer from '../containers/ExternalOrganizationContainer.vue';
import { EditEmailTemplatesView } from '../email';
import { useEventsObjectFetcher } from '../fetchers';
import EditGroupView from '../groups/EditGroupView.vue';
import { useAuth, useContext, useGlobalEventListener, useOrganization, usePlatform } from '../hooks';
import IconContainer from '../icons/IconContainer.vue';
import { MembersTableView, RegistrationCountSpan, useChooseOrganizationMembersForGroup } from '../members';
import { CenteredMessage } from '../overlays/CenteredMessage';
import { ContextMenu, ContextMenuItem } from '../overlays/ContextMenu';
import { Toast } from '../overlays/Toast';
import { useRequiredRegistrationsFilter } from '../registrations';
import RegistrationsTableView from '../registrations/RegistrationsTableView.vue';
import { useInfiniteObjectFetcher } from '../tables';
import ImageComponent from '../views/ImageComponent.vue';
import EditEventView from './EditEventView.vue';
import EventInfoTable from './components/EventInfoTable.vue';
import EventNotificationRow from '#event-notifications/components/EventNotificationRow.vue';
import { useCreateEventGroup } from './composables/createEventGroup';

const props = defineProps<{
    event: Event;
    onSaveDuplicate?: (event: Event) => void;
}>();

const title = computed(() => props.event.name);
const $navigate = useNavigate();
const organization = useOrganization();
const context = useContext();
const platform = usePlatform();
const pop = usePop();
const auth = useAuth();
const createEventGroup = useCreateEventGroup();
const eventOrganization: Ref<Organization | null> = ref(null);
const owner = useRequestOwner();
// @ts-ignore Something wrong with Vue converting structures to refs, causes too large types and causes a ts error "Type instantiation is excessively deep and possibly infinite."
const webshop = computed<WebshopPreview | null>(() => {
    if (!props.event.webshopId) {
        return null;
    }
    if (loadedWebshop.value) {
        return loadedWebshop.value;
    }
    return (eventOrganization.value?.webshops.find(w => w.id === props.event.webshopId) as any as WebshopPreview | undefined) ?? null;
});
const loadedWebshop = ref<WebshopPreview | null>(null);
let didLoadWebshop = false;
const loadingWebshop = ref(false);

function setOrganization(o: Organization) {
    eventOrganization.value = o;
    loadWebshop().catch(console.error);
}

const canEditWebshopHere = computed(() => {
    return !!props.event.webshopId && !!webshop.value && webshop.value.organizationId === organization.value?.id;
});

watch(() => props.event.webshopId, () => {
    // Reset webshop when the event's webshopId changes
    loadedWebshop.value = null;
    didLoadWebshop = false;
    loadingWebshop.value = false;
    loadWebshop().catch(console.error);
});

onMounted(() => {
    if (props.event.webshopId && !props.event.organizationId) {
        // Load the webshop of national events
        loadWebshop().catch(console.error);
    }
});

async function loadWebshop() {
    if (!props.event.webshopId) {
        return;
    }
    if (didLoadWebshop) {
        return;
    }
    let loaded = groupOrganization.value?.webshops.find(w => w.id === props.event.webshopId) ?? organization.value?.webshops.find(w => w.id === props.event.webshopId) ?? null;
    if (loaded) {
        console.error('Webshop already loaded', loaded);
        loadedWebshop.value = loaded;
        return;
    }

    const organizationId = props.event.organizationId ?? organization.value?.id ?? null;
    didLoadWebshop = true;
    loadingWebshop.value = true;

    // Fetch webshop by id
    try {
        const response = await context.value.getAuthenticatedServerForOrganization(organizationId).request({
            method: 'GET',
            path: '/webshop/' + props.event.webshopId,
            decoder: WebshopPreview as Decoder<WebshopPreview>,
            shouldRetry: true,
            owner,
        });
        loadedWebshop.value = response.data;
    }
    catch (e) {
        console.error('Failed to load webshop', e);
    }
    loadingWebshop.value = false;
}

const groupOrganization: Ref<Organization | null> = ref(null);

function setGroupOrganization(o: Organization) {
    groupOrganization.value = o;
}

const canWriteEvent = computed(() => auth.canWriteEventForOrganization(props.event, eventOrganization.value));
const patchOrganizationPeriod = usePatchOrganizationPeriod();

const levelPrefix = computed(() => {
    const prefixes: string[] = [];

    if (props.event.organizationId === null) {
        if (props.event.meta.organizationTagIds !== null) {
            const tagNames = platform.value?.config.tags.filter(t => props.event.meta.organizationTagIds?.includes(t.id)).map(t => t.name);
            prefixes.push(...tagNames);
        }
        else {
            prefixes.push($t(`%XF`));
        }
    }
    else {
        if (eventOrganization.value?.id === organization.value?.id) {
            // skip
        }
        else {
            // Name of the organization
            prefixes.push(eventOrganization.value?.name ?? props.event.organizationId);
        }
    }

    const base = Formatter.joinLast(prefixes, ', ', ' ' + $t(`%M1`) + ' ');

    if (groupOrganization.value && props.event.organizationId === null) {
        return `${base} (via ${groupOrganization.value.name})`;
    }

    return base;
});

const link = computed(() => {
    return `https://${STAMHOOFD.domains.dashboard}/${appToUri('registration')}/activiteiten/${props.event.startDate.getFullYear()}/${Formatter.slug(props.event.name)}/${props.event.id}`;
});

enum Routes {
    Registrations = 'inschrijvingen',
    WaitingList = 'wachtlijst',
    Edit = 'instellingen',
    EditGroup = 'inschrijvingsinstellingen',
    EditEmails = 'emails',
    Webshop = 'webshop',
}

const { getRequiredRegistrationsFilter } = useRequiredRegistrationsFilter();

function getCountFilter(g: Group) {
    return mergeFilters([
        {
            groupId: g.id,
        },
        getRequiredRegistrationsFilter({ group: g }, true),
    ]);
}

defineRoutes([{
    url: Routes.Registrations,
    component: RegistrationsTableView as ComponentOptions,
    paramsToProps: () => {
        if (!props.event.group) {
            throw new Error('No group found');
        }

        return {
            organization: eventOrganization.value,
            group: props.event.group,
            dateRange: {
                start: props.event.startDate,
                end: props.event.endDate,
            },
        };
    },
},
{
    url: Routes.WaitingList,
    component: MembersTableView as ComponentOptions,
    paramsToProps: () => {
        if (!props.event.group || !props.event.group.waitingList) {
            throw new Error('No waiting list found');
        }
        return {
            group: props.event.group.waitingList,
        };
    },
},
{
    url: Routes.Edit,
    component: EditEventView as ComponentOptions,
    present: 'popup',
    paramsToProps: () => {
        return {
            event: props.event,
            isNew: false,
        };
    },
},
{
    url: Routes.EditGroup,
    component: EditGroupView as ComponentOptions,
    present: 'popup',
    paramsToProps: async () => {
        if (!props.event.group) {
            throw new Error('Missing group');
        }

        const group = props.event.group;
        const period = await prepareOrganizationPeriod(group);

        return {
            period,
            groupId: props.event.group.id,
            isMultiOrganization: !props.event.organizationId,
            organizationHint: eventOrganization.value ?? groupOrganization.value,
            isNew: false,
            showToasts: true,
            saveHandler: async (patch: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => {
                const updatedPeriod = await patchOrganizationPeriod(patch, {
                    organizationId: group.organizationId,
                });

                const updatedGroup = updatedPeriod.groups.find(g => g.id === group.id);
                if (updatedGroup) {
                    group.deepSet(updatedGroup);

                    if (updatedGroup.deletedAt) {
                        props.event.group = null;
                    }
                }
                else {
                    console.warn('Group not found in updated period', group.id, updatedPeriod.groups);
                    props.event.group = null;
                }
            },
        };
    },
},
{
    url: Routes.EditEmails,
    component: EditEmailTemplatesView as ComponentOptions,
    present: 'popup',
    paramsToProps: () => {
        if (!props.event.group) {
            throw new Error('Missing group');
        }

        return {
            groups: props.event.group.waitingList ? [props.event.group, props.event.group.waitingList] : [props.event.group],
            allowEditGenerated: false,
            types: [
                EmailTemplateType.RegistrationConfirmation,
            ],
        };
    },
},
{
    url: Routes.Webshop,
    component: async () => {
        return (await import('@stamhoofd/dashboard/src/views/dashboard/webshop/WebshopOverview.vue')).default;
    },
    paramsToProps: ({ slug }: { slug: string }) => {
        if (!webshop.value) {
            throw new Error('Webshop not found');
        }

        return {
            preview: webshop.value,
        };
    },
},
]);

const chooseOrganizationMembersForGroup = useChooseOrganizationMembersForGroup();
const prepareOrganizationPeriod = useFetchOrganizationPeriodForGroup();

const present = usePresent();
async function createWebshop() {
    if (!auth.hasAccessRight(AccessRight.OrganizationCreateWebshops)) {
        Toast.warning($t('%1Am')).show();
        return;
    }

    await present({
        components: [
            await LoadComponent(
                () => import('@stamhoofd/dashboard/src/views/dashboard/webshop/edit/EditWebshopGeneralView.vue'),
                {
                    initialWebshop: PrivateWebshop.create({
                        meta: WebshopMetaData.create({
                            name: props.event.name,
                            description: props.event.meta.description,
                            coverPhoto: props.event.meta.coverPhoto,
                        }),
                    }),
                    savedHandler: async (webshop: PrivateWebshop) => {
                        await directPatch(
                            Event.patch({
                                id: props.event.id,
                                webshopId: webshop.id,
                            }),
                        );
                        Toast.success($t('%1An')).show();
                        await nextTick();
                        await $navigate(
                            Routes.Webshop,
                        );
                    },
                },
            ),
        ],
        modalDisplayStyle: 'popup',
    });
}

async function unlinkWebshop() {
    if (!await CenteredMessage.confirm(
        $t('%1Ao'),
        $t('%1Ap'),
        $t('%1Aq'),
    )) {
        return;
    }

    try {
        await directPatch(
            Event.patch({
                id: props.event.id,
                webshopId: null,
            }),
        );
    }
    catch (e) {
        Toast.fromError(e).show();
    }
}

async function linkWebshop(event: MouseEvent) {
    const org = eventOrganization.value ?? organization.value;
    if (!org) {
        Toast.warning($t(`%1CE`)).show();
        return;
    }

    const contextMenu = new ContextMenu([
        [
            new ContextMenuItem({
                icon: 'add',
                name: 'Nieuwe webshop',
                action: async () => {
                    await createWebshop();
                },
            }),
            new ContextMenuItem({
                name: 'Bestaande webshop koppelen',
                disabled: !org || org.webshops.length === 0,
                childMenu: new ContextMenu([
                    org.webshops.filter(w => w.meta.status !== WebshopStatus.Archived).map(webshop => new ContextMenuItem({
                        name: webshop.meta.name,
                        action: async () => {
                            try {
                                await directPatch(
                                    Event.patch({
                                        id: props.event.id,
                                        webshopId: webshop.id,
                                    }),
                                );
                                Toast.success($t('%1Ar')).show();
                            }
                            catch (e) {
                                Toast.fromError(e).show();
                            }
                        },
                    })),
                    org.webshops.filter(w => w.meta.status === WebshopStatus.Archived).map(webshop => new ContextMenuItem({
                        name: webshop.meta.name,
                        action: async () => {
                            try {
                                await directPatch(
                                    Event.patch({
                                        id: props.event.id,
                                        webshopId: webshop.id,
                                    }),
                                );
                                Toast.success($t('%1Ar')).show();
                            }
                            catch (e) {
                                Toast.fromError(e).show();
                            }
                        },
                    })),
                ]),
            }),
        ],
    ]);
    await contextMenu.show({
        button: event.currentTarget as HTMLElement,
        xPlacement: 'left',
    });
}

async function directPatch(patch: AutoEncoderPatchType<Event>, event: Event = props.event) {
    patch.id = event.id;

    const arr = new PatchableArray() as PatchableArrayAutoEncoder<Event>;
    arr.addPatch(patch);

    const response = await context.value.authenticatedServer.request({
        method: 'PATCH',
        path: '/events',
        body: arr,
        decoder: new ArrayDecoder(Event as Decoder<Event>),
    });

    // Make sure original event is patched
    deepSetArray([event], response.data);
}

async function createGroup() {
    if (!await CenteredMessage.confirm(
        $t('%16b'),
        $t('%16Y'),
        $t('%16c'),
        undefined,
        false,
    )) {
        return;
    }

    try {
        await createEventGroup(props.event, async (group: Group) => {
            // Set event group and save
            const patch = Event.patch({
                id: props.event.id,
                group: group,
            });

            await directPatch(patch);

            // Navigate to the new group settings
            // $navigate(Routes.EditGroup).catch(console.error);
        });
    }
    catch (e) {
        Toast.fromError(e).show();
    }
}

async function addMembers() {
    if (!props.event.group) {
        return;
    }

    if (!organization.value) {
        Toast.warning($t(`%ya`)).show();
        return;
    }

    await chooseOrganizationMembersForGroup({
        members: [],
        group: props.event.group,
    });
}

const objectFetcher = useEventsObjectFetcher();
const fetcher = useInfiniteObjectFetcher<Event>(objectFetcher);

async function loadEvent(event: Event): Promise<Event> {
    const events = await fetcher.objectFetcher.fetch(
        new LimitedFilteredRequest({
            filter: {
                id: event.id,
            },
            limit: 1,
            sort: [],
        }),
    );

    if (events.results.length === 1) {
        return events.results[0];
    }
    Toast.error($t(`%yc`)).show();
    throw new Error('Event not found');
}
function duplicateEvent() {
    if (!props.onSaveDuplicate) {
        return;
    }

    async function duplicateGroupForEvent(event: Event, groupToDuplicate: Group, emailTemplates: EmailTemplate[]) {
        let duplicateGroup: Group | undefined;

        try {
            const clonedGroup = groupToDuplicate.clone();
            const period = eventOrganization.value?.period.period;

            duplicateGroup = Group.create({
                ...clonedGroup,
                id: undefined,
                periodId: period?.id,
                stockReservations: [],
                settings: GroupSettings.create({
                    ...clonedGroup.settings,
                    eventId: event.id,
                    period: undefined,
                    name: TranslatedString.create(event.name),
                }),
                createdAt: undefined,
                status: GroupStatus.Closed,

            });

            // Set event group and save
            const patch = Event.patch({
                id: event.id,
                group: duplicateGroup,
            });

            await directPatch(patch, event);
        }
        catch (e) {
            console.error(e);
            new Toast('Er ging iets mis bij het overnemen van de inschrijvingsgroep voor de nieuwe activiteit', 'warning').show();
        }

        if (!duplicateGroup) {
            return;
        }

        // Copy email templates
        try {
            const patchedArray: PatchableArrayAutoEncoder<EmailTemplate> = new PatchableArray();
            for (const t of emailTemplates) {
                if (t.groupId !== groupToDuplicate.id) {
                // Skip default templates
                    continue;
                }

                // Create a new duplicate
                const template = EmailTemplate.create({
                    ...t,
                    groupId: duplicateGroup.id,
                    id: undefined,
                });
                patchedArray.addPut(template);
            }

            if (patchedArray.getPuts().length > 0) {
                await context.value.authenticatedServer.request({
                    method: 'PATCH',
                    path: '/email-templates',
                    body: patchedArray,
                    shouldRetry: false,
                    owner,
                });
            }
        }
        catch (e) {
            console.error(e);
            new Toast('Er ging iets mis bij het overnemen van de e-mails voor de nieuwe activiteit', 'warning').show();
        }
    }

    const displayedComponent = new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(PromiseView, {
            promise: async () => {
                try {
                    // Make sure we have an up to date event
                    const fetchedEvent = await loadEvent(props.event);

                    const duplicateEvent = Event.create({
                        ...fetchedEvent.clone(),
                        // will be set later
                        group: null,
                        webshopId: null,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        id: undefined,
                    });

                    let templates: EmailTemplate[] = [];

                    if (fetchedEvent.group) {
                        const response = await context.value.authenticatedServer.request({
                            method: 'GET',
                            path: '/email-templates',
                            query: { groupIds: [fetchedEvent.group.id] },
                            shouldRetry: false,
                            owner,
                            decoder: new ArrayDecoder(EmailTemplate as Decoder<EmailTemplate>),
                        });
                        templates = response.data;
                    }

                    return new ComponentWithProperties(EditEventView, {
                        event: duplicateEvent,
                        isNew: true,
                        callback: async () => {
                            if (fetchedEvent.group) {
                                await duplicateGroupForEvent(duplicateEvent, fetchedEvent.group, templates);
                            }

                            if (props.onSaveDuplicate) {
                                props.onSaveDuplicate(duplicateEvent);
                            }
                        },
                    });
                }
                catch (e) {
                    Toast.fromError(e).show();
                    throw e;
                }
            },
        }),
    });

    present({
        animated: true,
        adjustHistory: true,
        modalDisplayStyle: 'popup',
        components: [
            displayedComponent,
        ],
    }).catch(console.error);
}

useGlobalEventListener('event-deleted', async (event: Event) => {
    if (event.id === props.event.id) {
        await pop({ force: true });
    }
});
</script>

<style lang="scss">
.event-overview {
    .description {
        margin-bottom: 20px;
    }
}
</style>
