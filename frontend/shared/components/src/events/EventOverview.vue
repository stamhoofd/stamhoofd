<template>
    <ExternalOrganizationContainer v-slot="{externalOrganization: eventOrganization}" :organization-id="event.organizationId" @update="setOrganization">
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
                    <template v-if="event.group && (!organization || event.group.organizationId === organization.id || event.group.settings.allowRegistrationsByOrganization)">
                        <STListItem :selectable="true" class="left-center right-stack" @click="$navigate(Routes.Registrations)">
                            <template #left>
                                <span class="icon group" />
                            </template>

                            <h2 class="style-title-list">
                                Ingeschreven leden
                            </h2>
                            <p class="style-description">
                                Bekijk, beheer, exporteer of e-mail ingeschreven leden.
                            </p>
                            <template #right>
                                <span v-if="event.group.getMemberCount() !== null" class="style-description-small">{{ formatInteger(event.group.getMemberCount()!) }}</span>
                                <span class="icon arrow-right-small gray" />
                            </template>
                        </STListItem>

                        <STListItem v-if="event.group.waitingList && (!organization || event.group.organizationId === organization.id || event.group.waitingList.settings.allowRegistrationsByOrganization)" :selectable="true" class="left-center right-stack" @click="$navigate(Routes.WaitingList)">
                            <template #left>
                                <span class="icon clock" />
                            </template>

                            <h2 class="style-title-list">
                                {{ event.group.waitingList.settings.name }}
                            </h2>
                            <p class="style-description">
                                Bekijk leden op de wachtlijst
                            </p>
                            <template #right>
                                <span v-if="event.group.waitingList.getMemberCount() !== null" class="style-description-small">{{ formatInteger(event.group.waitingList.getMemberCount()!) }}</span>
                                <span class="icon arrow-right-small gray" />
                            </template>
                        </STListItem>
                    </template>
                </EventInfoTable>

                <div v-if="canWriteEvent" class="container">
                    <hr>
                    <h2>
                        Instellingen
                    </h2>

                    <STList class="illustration-list">
                        <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.Edit)">
                            <template #left>
                                <img src="@stamhoofd/assets/images/illustrations/flag.svg">
                            </template>
                            <h2 class="style-title-list">
                                Algemeen
                            </h2>
                            <p class="style-description">
                                Wijzig de naam, beschrijving, datum en beschikbaarheid.
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
                                Inschrijvingsinstellingen
                            </h2>
                            <p class="style-description">
                                Wijzig hoe leden kunnen inschrijven, de tarieven en de verzamelde gegevens.
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
                                E-mailsjablonen
                            </h2>
                            <p class="style-description">
                                Wijzig de inhoud van automatische e-mails naar leden die zijn of worden ingeschreven voor deze activiteit.
                            </p>
                            <template #right>
                                <span class="icon arrow-right-small gray" />
                            </template>
                        </STListItem>

                        <EventNotificationRow v-for="type of event.eventNotificationTypes" v-if="eventOrganization" :key="type.id" class="container" :type="type" :event="event" :organization="eventOrganization" />
                    </STList>
                </div>
                <hr>
                <h2>Link kopiëren</h2>
                <p>{{ $t("40b31f32-5a02-488d-beb3-d987ea5c9315") }}</p>

                <div class="input-with-buttons">
                    <div>
                        <input class="input" :value="link" readonly>
                    </div>
                    <div>
                        <button v-copyable="link" type="button" class="button text">
                            <span class="icon copy" />
                            <span class="hide-small">Kopiëren</span>
                        </button>
                    </div>
                </div>

                <template v-if="event.group && (!organization || event.organizationId === organization.id || (event.group.settings.allowRegistrationsByOrganization && !event.group.closed))">
                    <hr>
                    <h2>Handmatig leden inschrijven</h2>

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
                            <span class="icon add" />
                            <span>Leden inschrijven</span>
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
