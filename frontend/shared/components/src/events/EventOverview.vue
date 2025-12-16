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
                                    {{ $t('ba230e6d-38eb-4bf4-9735-4249c96a95e9') }}
                                </h2>
                                <p class="style-description">
                                    {{ $t('8063280c-a4d1-4acf-a54d-dff02e973909') }}
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
                                    {{ $t('8e8cd172-b1c4-4b9e-ad06-e99f5e40a645') }}
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
                            {{ $t('bab38c80-8ab6-4cb7-80c3-1f607057e45d') }}
                        </h2>

                        <STList class="illustration-list">
                            <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.Edit)">
                                <template #left>
                                    <img src="@stamhoofd/assets/images/illustrations/flag.svg">
                                </template>
                                <h2 class="style-title-list">
                                    {{ $t('35757756-d817-419d-82dd-1ba14128af30') }}
                                </h2>
                                <p class="style-description">
                                    {{ $t('b95cfa13-c42d-4d2f-892b-d2fc4c4c9bd1') }}
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
                                    {{ $t('269b5fdf-7cfc-46ed-84c9-40836ff5da9c') }}
                                </h2>
                                <p class="style-description">
                                    {{ $t('af4c5417-03ad-4997-b8e2-5ff3b47ac045') }}
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
                                    {{ $t('f0b50a39-d4fd-4f97-802d-a599b00030fd') }}
                                </h2>
                                <p class="style-description">
                                    {{ $t('7c32440d-6a06-4a53-8522-b84c0227fbfe') }}
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
                                    {{ $t('9d7bf734-ef1e-421b-ae0f-3dec3040a360') }}
                                </h2>
                                <h2 v-else class="style-title-list">
                                    {{ webshop.meta.name ?? $t('adb2856b-67d7-4dbf-bf16-e4478250a05d') }}
                                </h2>
                                <p v-if="canEditWebshopHere" class="style-description-small">
                                    {{ $t('485a1995-f06e-4c04-a9cb-8f38a043cf98') }}
                                </p>
                                <p v-else-if="webshop" class="style-description-small">
                                    {{ $t('198e7383-2512-4f6f-b919-2b4225b8e2a9') }}
                                </p>
                                <p v-else class="style-description-small">
                                    {{ $t('dd4ec83e-2d84-406b-9f3b-4fb1ba3e6fc7') }}
                                </p>
                                <template #right>
                                    <button v-if="canWriteEvent" v-tooltip="$t('5ac02b3f-f412-43de-bd15-45b9679635b4')" class="button icon unlink" type="button" @click.stop="unlinkWebshop" />
                                    <span v-if="canEditWebshopHere" class="icon arrow-right-small gray" />
                                </template>
                            </STListItem>

                            <template v-if="eventOrganization">
                                <EventNotificationRow v-for="type of event.eventNotificationTypes" :key="type.id" class="container" :type="type" :event="event" :organization="eventOrganization" />
                            </template>
                        </STList>
                    </div>

                    <hr>
                    <h2>{{ $t('28d8fecc-3639-467b-90d5-1ac8e82240df') }}</h2>
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
                                {{ $t('0c4eaa6c-d6c6-411f-af6d-aa73233cf2c0') }}
                            </h2>
                            <p class="style-description-small">
                                {{ $t('004bab40-945f-4f6d-8316-b0a8f2748f7a') }}
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
                                {{ $t('dac9e7f1-a040-4eb3-8a2b-95d10815814d') }}
                            </h2>
                            <p class="style-description-small">
                                {{ $t('d24fec9e-48d1-46ad-a02b-27d81f2eee6e') }}
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
                                {{ $t('f4186487-551f-4268-b811-c2b31ace72d1') }}
                            </h2>
                            <p v-if="organization && event.organizationId === organization.id" class="style-description-small">
                                {{ $t('3f4666f9-59b5-4a24-b1a7-9f820275c042') }}
                            </p>
                            <p v-else-if="!event.group.settings.isFree" class="style-description-small">
                                {{ $t('3ab07939-121b-47f9-956f-a573c57ec008') }}
                            </p>
                            <p v-else class="style-description-small">
                                {{ $t('7cac9136-10b5-4f1c-b9a4-0fb3f8410a9b') }}
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
                                {{ $t('cd9912f4-89a4-44ea-b8a0-40371a53b90a') }}
                            </h2>
                            <p class="style-description-small">
                                {{ $t("40b31f32-5a02-488d-beb3-d987ea5c9315") }}
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
import { defineRoutes, useNavigate, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { useFetchOrganizationPeriodForGroup, usePatchOrganizationPeriod, useRequestOwner } from '@stamhoofd/networking';
import { AccessRight, appToUri, EmailTemplateType, Event, Group, mergeFilters, Organization, OrganizationRegistrationPeriod, PrivateWebshop, WebshopMetaData, WebshopPreview, WebshopStatus } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { ComponentOptions, computed, nextTick, onMounted, Ref, ref, watch } from 'vue';
import { LoadComponent } from '../containers';
import ExternalOrganizationContainer from '../containers/ExternalOrganizationContainer.vue';
import { EditEmailTemplatesView } from '../email';
import EditGroupView from '../groups/EditGroupView.vue';
import { useAuth, useContext, useGlobalEventListener, useOrganization, usePlatform } from '../hooks';
import IconContainer from '../icons/IconContainer.vue';
import { MembersTableView, RegistrationCountSpan, useChooseOrganizationMembersForGroup } from '../members';
import { CenteredMessage } from '../overlays/CenteredMessage';
import { ContextMenu, ContextMenuItem } from '../overlays/ContextMenu';
import { Toast } from '../overlays/Toast';
import { useRequiredRegistrationsFilter } from '../registrations';
import RegistrationsTableView from '../registrations/RegistrationsTableView.vue';
import ImageComponent from '../views/ImageComponent.vue';
import EditEventView from './EditEventView.vue';
import EventInfoTable from './components/EventInfoTable.vue';
import EventNotificationRow from './components/EventNotificationRow.vue';
import { useCreateEventGroup } from './composables/createEventGroup';

const props = defineProps<{
    event: Event;
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
    return props.event.webshopId && webshop.value && webshop.value.organizationId === organization.value?.id;
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
            prefixes.push($t(`81df09d0-56ee-491d-b474-85173b1401dd`));
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

    const base = Formatter.joinLast(prefixes, ', ', ' ' + $t(`c1843768-2bf4-42f2-baa4-42f49028463d`) + ' ');

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
        Toast.warning($t('59920662-aed6-44f6-92f5-d7a72806f405')).show();
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
                        Toast.success($t('e42ea38b-dfc2-4af2-bd91-be24934b7a75')).show();
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
        $t('0062b0f9-02e8-4c27-a0bd-addf7823ee8b'),
        $t('be506b1b-2d5e-45fc-990b-f833e2d3ee24'),
        $t('524263ab-0ec7-41da-84cd-d5ca9da243bd'),
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
        Toast.warning($t(`449df98c-76b7-49b5-b807-9a431336fa86`)).show();
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
                                Toast.success($t('9be3a9ea-451a-4d71-b32e-ac7aa2bee4e6')).show();
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
                                Toast.success($t('9be3a9ea-451a-4d71-b32e-ac7aa2bee4e6')).show();
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

async function directPatch(patch: AutoEncoderPatchType<Event>) {
    patch.id = props.event.id;

    const arr = new PatchableArray() as PatchableArrayAutoEncoder<Event>;
    arr.addPatch(patch);

    const response = await context.value.authenticatedServer.request({
        method: 'PATCH',
        path: '/events',
        body: arr,
        decoder: new ArrayDecoder(Event as Decoder<Event>),
    });

    // Make sure original event is patched
    deepSetArray([props.event], response.data);
}

async function createGroup() {
    if (!await CenteredMessage.confirm(
        $t('e8050ed2-af7e-4ffd-a9c9-e2fda7ef9bf5'),
        $t('26667b28-4e39-4218-9f9b-131bf3bae6ab'),
        $t('3fa34288-9872-4c2b-af11-2d112b905eef'),
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
        Toast.warning($t(`853fe2cb-6cf6-48a3-8ee8-a0cf30b1a823`)).show();
        return;
    }

    await chooseOrganizationMembersForGroup({
        members: [],
        group: props.event.group,
    });
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
