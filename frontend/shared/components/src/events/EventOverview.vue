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

            <template v-if="event.group">
                <hr>
                <h2>Bekijken</h2>

                <STList class="illustration-list">
                    <STListItem :selectable="true" class="left-center right-stack" @click="$navigate(Routes.Registrations)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/edit-data.svg">
                        </template>
                        <h2 class="style-title-list">
                            Ingeschreven leden
                        </h2>
                        <p class="style-description">
                            Bekijk, beheer, exporteer, e-mail of SMS ingeschreven leden.
                        </p>
                        <template #right>
                            <span v-if="event.group.getMemberCount() !== null" class="style-description-small">{{ formatInteger(event.group.getMemberCount()!) }}</span>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem v-if="event.group.waitingList" :selectable="true" class="left-center right-stack" @click="$navigate(Routes.WaitingList)">
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

            <hr>
            <h2>Instellingen</h2>

            <STList class="illustration-list">
                <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.Edit)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/flag.svg">
                    </template>
                    <h2 class="style-title-list">
                        Instellingen
                    </h2>
                    <p class="style-description">
                        Wijzig de instellingen van deze activiteit.
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script setup lang="ts">
import { defineRoutes, useNavigate } from '@simonbackx/vue-app-navigation';
import { Event } from '@stamhoofd/structures';
import { ComponentOptions, computed } from 'vue';
import { MembersTableView } from '../members';
import ImageComponent from '../views/ImageComponent.vue';
import EditEventView from './EditEventView.vue';

const props = defineProps<{
    event: Event;
}>();

const title = computed(() => props.event.name);
const $navigate = useNavigate();

enum Routes {
    Registrations = 'inschrijvingen',
    WaitingList = 'wachtlijst',
    Edit = "instellingen"
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
])


</script>
