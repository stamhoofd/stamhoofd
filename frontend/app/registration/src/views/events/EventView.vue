<template>
    <div class="st-view">
        <STNavigationBar :title="title" />

        <main class="center">
            <ImageComponent v-if="event.meta.coverPhoto" :image="event.meta.coverPhoto" :auto-height="true" class="style-cover-photo" />

            <h1 class="style-navigation-title">
                {{ title }}
            </h1>

            <div v-if="event.meta.description.html" class="description style-wysiwyg gray large" v-html="event.meta.description.html" />
        </main>
    </div>
</template>

<script setup lang="ts">
import { ImageComponent } from '@stamhoofd/components';
import { Event } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = defineProps<{
    event: Event;
}>();

const title = computed(() => props.event.name);

</script>
