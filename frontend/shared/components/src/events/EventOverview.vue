<template>
    <ExternalOrganizationContainer v-slot="{externalOrganization: eventOrganization}" :organization-id="event.organizationId" @update="setOrganization">
        <div class="st-view event-overview">
            <STNavigationBar :title="title"/>

            <main class="center">
                <ImageComponent v-if="event.meta.coverPhoto" :image="event.meta.coverPhoto" :auto-height="true" class="style-cover-photo"/>

                <p class="style-title-prefix">
                    {{ levelPrefix }}
                </p>
                <h1 class="style-navigation-title">
                    {{ title }}
                </h1>

                <template v-if="event.meta.description.html">
                    <div class="description style-wysiwyg gray large" v-html="event.meta.description.html"/>
                </template>

                <EventInfoTable :event="event">
                    <template v-if="event.group && (!organization || event.group.organizationId === organization.id || event.group.settings.allowRegistrationsByOrganization)">
                        <STListItem :selectable="true" class="left-center right-stack" @click="$navigate(Routes.Registrations)">
                            <template #left>
                                <span class="icon group"/>
                            </template>

                            <h2 class="style-title-list">
                                {{ $t('c252fbf3-d038-4cee-a1b3-9c84a54644fd') }}
                            </h2>
                            <p class="style-description">
                                {{ $t('20da7617-2d90-4e9f-841d-3151ef0e7f14') }}
                            </p>
                            <template #right>
                                <span v-if="event.group.getMemberCount() !== null" class="style-description-small">{{ formatInteger(event.group.getMemberCount()!) }}</span>
                                <span class="icon arrow-right-small gray"/>
                            </template>
                        </STListItem>

                        <STListItem v-if="event.group.waitingList && (!organization || event.group.organizationId === organization.id || event.group.waitingList.settings.allowRegistrationsByOrganization)" :selectable="true" class="left-center right-stack" @click="$navigate(Routes.WaitingList)">
                            <template #left>
                                <span class="icon clock"/>
                            </template>

                            <h2 class="style-title-list">
                                {{ event.group.waitingList.settings.name }}
                            </h2>
                            <p class="style-description">
                                {{ $t('70518913-efd7-4546-a5f7-569712da6888') }}
                            </p>
                            <template #right>
                                <span v-if="event.group.waitingList.getMemberCount() !== null" class="style-description-small">{{ formatInteger(event.group.waitingList.getMemberCount()!) }}</span>
                                <span class="icon arrow-right-small gray"/>
                            </template>
                        </STListItem>
                    </template>
                </EventInfoTable>

                <div v-if="canWriteEvent" class="container">
                    <hr><h2>
                        {{ $t('a370eff9-c1c1-450c-8bdb-dcee89bd2f70') }}
                    </h2>

                    <STList class="illustration-list">
                        <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.Edit)">
                            <template #left>
                                <img src="@stamhoofd/assets/images/illustrations/flag.svg"></template>
                            <h2 class="style-title-list">
                                {{ $t('f8ce21aa-06de-4373-874c-ddad1629cad8') }}
                            </h2>
                            <p class="style-description">
                                {{ $t('76272d65-bf87-4d72-89f7-5a0a42eb92f6') }}
                            </p>
                            <template #right>
                                <span class="icon arrow-right-small gray"/>
                            </template>
                        </STListItem>

                        <STListItem v-if="event.group" :selectable="true" class="left-center" @click="$navigate(Routes.EditGroup)">
                            <template #left>
                                <img src="@stamhoofd/assets/images/illustrations/list.svg"></template>
                            <h2 class="style-title-list">
                                {{ $t('bfacf7f3-1216-4efb-abd0-8a681c9e9912') }}
                            </h2>
                            <p class="style-description">
                                {{ $t('b169f5af-86c5-472a-88ef-e4f4d956610d') }}
                            </p>
                            <template #right>
                                <span class="icon arrow-right-small gray"/>
                            </template>
                        </STListItem>

                        <STListItem v-if="event.group" :selectable="true" class="left-center" @click="$navigate(Routes.EditEmails)">
                            <template #left>
                                <img src="@stamhoofd/assets/images/illustrations/email-template.svg"></template>
                            <h2 class="style-title-list">
                                {{ $t('e4e79acd-2538-406e-927c-e18c5383a493') }}
                            </h2>
                            <p class="style-description">
                                {{ $t('429cb238-7f3f-4cd9-b4cf-345f6a0e938f') }}
                            </p>
                            <template #right>
                                <span class="icon arrow-right-small gray"/>
                            </template>
                        </STListItem>

                        <EventNotificationRow v-for="type of event.eventNotificationTypes" v-if="eventOrganization" :key="type.id" class="container" :type="type" :event="event" :organization="eventOrganization"/>
                    </STList>
                </div>
                <hr><h2>{{ $t('3d843783-9cb5-4ae9-818a-40e845c8bf67') }}</h2>
                <p>{{ $t("40b31f32-5a02-488d-beb3-d987ea5c9315") }}</p>

                <div class="input-with-buttons">
                    <div>
                        <input class="input" :value="link" readonly></div>
                    <div>
                        <button v-copyable="link" type="button" class="button text">
                            <span class="icon copy"/>
                            <span class="hide-small">{{ $t('32f946c9-f58e-4a8b-9772-d8897ec186ac') }}</span>
                        </button>
                    </div>
                </div>

                <template v-if="event.group && (!organization || event.organizationId === organization.id || (event.group.settings.allowRegistrationsByOrganization && !event.group.closed))">
                    <hr><h2>{{ $t('db57d5a7-43e6-45db-8735-ec9a55104562') }}</h2>

                    <p v-if="organization && event.organizationId === organization.id">
                        {{ $t('3f4666f9-59b5-4a24-b1a7-9f820275c042') }}
                    </p>
                    <p v-else-if="!event.group.settings.isFree">
                        {{ $t('3ab07939-121b-47f9-956f-a573c57ec008') }}
                    </p>
                    <p v-else>
                        {{ $t('7cac9136-10b5-4f1c-b9a4-0fb3f8410a9b') }}
                    </p>

                    <p class="style-button-bar">
                        <button class="button primary" type="button" @click="addMembers">
                            <span class="icon add"/>
                            <span>{{ $t('884874cc-4375-49e8-a5d5-51c0d615d18f') }}</span>
                        </button>
                    </p>
                </template>
            </main>
        </div>
    </ExternalOrganizationContainer>
</template>

<script setup lang="ts">
import { ArrayDecoder, AutoEncoderPatchType, Decoder, deepSetArray, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { defineRoutes, useNavigate, usePop } from '@simonbackx/vue-app-navigation';
import { EmailTemplateType, Event, Group, Organization } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { ComponentOptions, computed, Ref, ref } from 'vue';
import ExternalOrganizationContainer from '../containers/ExternalOrganizationContainer.vue';
import { appToUri } from '../context';
import { EditEmailTemplatesView } from '../email';
import EditGroupView from '../groups/EditGroupView.vue';
import { useAuth, useContext, useGlobalEventListener, useOrganization, usePlatform } from '../hooks';
import { MembersTableView, useChooseOrganizationMembersForGroup } from '../members';
import { Toast } from '../overlays/Toast';
import ImageComponent from '../views/ImageComponent.vue';
import EditEventView from './EditEventView.vue';
import EventInfoTable from './components/EventInfoTable.vue';
import EventNotificationRow from './components/EventNotificationRow.vue';

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

const eventOrganization: Ref<Organization | null> = ref(null);

function setOrganization(o: Organization) {
    eventOrganization.value = o;
}

const canWriteEvent = computed(() => auth.canWriteEventForOrganization(props.event, eventOrganization.value));

const levelPrefix = computed(() => {
    const prefixes: string[] = [];

    if (props.event.organizationId === null) {
        if (props.event.meta.organizationTagIds !== null) {
            const tagNames = platform.value?.config.tags.filter(t => props.event.meta.organizationTagIds?.includes(t.id)).map(t => t.name);
            prefixes.push(...tagNames);
        }
        else {
            prefixes.push('Nationaal');
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

    return Formatter.joinLast(prefixes, ', ', ' en ');
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
}

defineRoutes([
    {
        url: Routes.Registrations,
        component: MembersTableView as ComponentOptions,
        paramsToProps: () => {
            if (!props.event.group) {
                throw new Error('No group found');
            }
            return {
                group: props.event.group,
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
        paramsToProps: () => {
            if (!props.event.group) {
                throw new Error('Missing group');
            }

            return {
                group: props.event.group,
                isMultiOrganization: !props.event.organizationId,
                isNew: false,
                showToasts: true,
                saveHandler: async (patch: AutoEncoderPatchType<Group>) => {
                    const arr = new PatchableArray() as PatchableArrayAutoEncoder<Event>;

                    arr.addPatch(Event.patch({
                        id: props.event.id,
                        group: patch,
                    }));

                    const response = await context.value.authenticatedServer.request({
                        method: 'PATCH',
                        path: '/events',
                        body: arr,
                        decoder: new ArrayDecoder(Event as Decoder<Event>),
                    });

                    // Make sure original event is patched
                    deepSetArray([props.event], response.data);
                },
                deleteHandler: async () => {
                    const arr = new PatchableArray() as PatchableArrayAutoEncoder<Event>;

                    arr.addPatch(Event.patch({
                        id: props.event.id,
                        group: null,
                    }));

                    const response = await context.value.authenticatedServer.request({
                        method: 'PATCH',
                        path: '/events',
                        body: arr,
                        decoder: new ArrayDecoder(Event as Decoder<Event>),
                    });

                    // Make sure original event is patched
                    deepSetArray([props.event], response.data);
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
]);
const chooseOrganizationMembersForGroup = useChooseOrganizationMembersForGroup();

async function addMembers() {
    if (!props.event.group) {
        return;
    }

    if (!organization.value) {
        Toast.warning('Ga naar het beheerdersportaal van een groep om leden uit die groep toe te voegen. Dit kan niet via het administratieportaal.').show();
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
