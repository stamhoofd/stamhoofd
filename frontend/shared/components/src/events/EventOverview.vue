<template>
    <div class="st-view">
        <STNavigationBar :title="title" />

        <main class="center">
            <ImageComponent v-if="event.meta.coverPhoto" :image="event.meta.coverPhoto" :auto-height="true" class="style-cover-photo" />

            <h1 class="style-navigation-title">
                {{ title }}
            </h1>

            <template v-if="event.meta.description.html">
                <div class="description style-wysiwyg gray large" v-html="event.meta.description.html" />
            </template>

            <template v-if="event.group && (!organization || event.organizationId === organization.id || event.group.settings.allowRegistrationsByOrganization)">
                <hr>
                <h2>Inschrijvingen</h2>

                <STList class="illustration-list">
                    <STListItem :selectable="true" class="left-center right-stack" @click="$navigate(Routes.Registrations)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/edit-data.svg">
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

                    <STListItem v-if="event.group.waitingList && (!organization || event.organizationId === organization.id || event.group.waitingList.settings.allowRegistrationsByOrganization)" :selectable="true" class="left-center right-stack" @click="$navigate(Routes.WaitingList)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/clock.svg">
                        </template>
                        <h2 class="style-title-list">
                            Wachtlijst
                        </h2>
                        <p class="style-description">
                            Bekijk leden op de wachtlijst
                        </p>
                        <template #right>
                            <span v-if="event.group.waitingList.getMemberCount() !== null" class="style-description-small">{{ formatInteger(event.group.waitingList.getMemberCount()!) }}</span>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
            </template>

            <template v-if="hasFullAccess">
                <hr>
                <h2 v-if="event.group && (!organization || event.organizationId === organization.id || event.group.settings.allowRegistrationsByOrganization)">Instellingen</h2>

                <STList class="illustration-list">
                    <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.Edit)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/flag.svg">
                        </template>
                        <h2 class="style-title-list">
                            Instellingen
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
                            Automatische e-mails
                        </h2>
                        <p class="style-description">
                            Wijzig de inhoud van automatische e-mails naar leden die zijn of worden ingeschreven.
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
            </template>
        </main>
    </div>
</template>

<script setup lang="ts">
import { ArrayDecoder, AutoEncoderPatchType, Decoder, deepSetArray, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { defineRoutes, useNavigate } from '@simonbackx/vue-app-navigation';
import { EmailTemplateType, Event, Group } from '@stamhoofd/structures';
import { ComponentOptions, computed } from 'vue';
import { EditEmailTemplatesView } from '../email';
import EditGroupView from '../groups/EditGroupView.vue';
import { useContext, useOrganization } from '../hooks';
import { MembersTableView } from '../members';
import ImageComponent from '../views/ImageComponent.vue';
import EditEventView from './EditEventView.vue';

const props = defineProps<{
    event: Event;
}>();

const title = computed(() => props.event.name);
const $navigate = useNavigate();
const organization = useOrganization();
const context = useContext()

const hasFullAccess = computed(() => {
    return !organization.value || props.event.organizationId === organization.value.id;
});

enum Routes {
    Registrations = 'inschrijvingen',
    WaitingList = 'wachtlijst',
    Edit = "instellingen",
    EditGroup = "inschrijvingsinstellingen",
    EditEmails = "emails"
}

defineRoutes([
    {
        url: Routes.Registrations,
        component: MembersTableView as ComponentOptions,
        paramsToProps: () => {
            if (!props.event.group) {
                throw new Error("No group found")
            }
            return {
                group: props.event.group
            }
        }
    },
    {
        url: Routes.WaitingList,
        component: MembersTableView as ComponentOptions,
        paramsToProps: () => {
            if (!props.event.group || !props.event.group.waitingList) {
                throw new Error("No waiting list found")
            }
            return {
                group: props.event.group.waitingList
            }
        }
    },
    {
        url: Routes.Edit,
        component: EditEventView as ComponentOptions,
        present: 'popup',
        paramsToProps: () => {
            return {
                event: props.event,
                isNew: false
            }
        }
    },
    {
        url: Routes.EditGroup,
        component: EditGroupView as ComponentOptions,
        present: 'popup',
        paramsToProps: () => {
            if (!props.event.group) {
                throw new Error('Missing group')
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
                        group: patch
                    }))

                    const response = await context.value.authenticatedServer.request({
                        method: 'PATCH',
                        path: '/events',
                        body: arr,
                        decoder: new ArrayDecoder(Event as Decoder<Event>),
                    })

                    // Make sure original event is patched
                    deepSetArray([props.event], response.data)
                },
                deleteHandler: async () => {
                    const arr = new PatchableArray() as PatchableArrayAutoEncoder<Event>;
                    
                    arr.addPatch(Event.patch({
                        id: props.event.id,
                        group: null
                    }))

                    const response = await context.value.authenticatedServer.request({
                        method: 'PATCH',
                        path: '/events',
                        body: arr,
                        decoder: new ArrayDecoder(Event as Decoder<Event>),
                    })

                    // Make sure original event is patched
                    deepSetArray([props.event], response.data)
                }
            }
        }
    },
    {
        url: Routes.EditEmails,
        component: EditEmailTemplatesView as ComponentOptions,
        present: 'popup',
        paramsToProps: () => {
            if (!props.event.group) {
                throw new Error('Missing group')
            }
            
            return {
                groups: props.event.group.waitingList ? [props.event.group, props.event.group.waitingList] : [props.event.group],
                allowEditGenerated: false,
                types: [
                    EmailTemplateType.RegistrationConfirmation
                ]
            }
        }
    },
])


</script>
