<template>
    <div id="webshop-overview" class="st-view background">
        <STNavigationBar :title="title" />

        <main class="center">
            <h1 class="style-navigation-title">
                {{ title }}
            </h1>
            <ImageComponent v-if="event.meta.coverPhoto" :image="event.meta.coverPhoto" :auto-height="true" class="style-cover-photo" />
            <div v-if="event.meta.description.html" class="description style-wysiwyg" v-html="event.meta.description.html" />

            <STList class="illustration-list">
                <STListItem v-if="event.group" :selectable="true" class="left-center">
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
            </STList>

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
import ImageComponent from '../views/ImageComponent.vue';
import EditEventView from './EditEventView.vue';

const props = defineProps<{
    event: Event;
}>();

const title = computed(() => props.event.name);
const $navigate = useNavigate();

enum Routes {
    Edit = "instellingen"
}

defineRoutes([
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
