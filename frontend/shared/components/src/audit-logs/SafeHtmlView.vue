<template>
    <div class="st-view">
        <STNavigationBar :title="title" />
        <main ref="main">
            <SafeHtmlBox :html="html" />
        </main>
    </div>
</template>

<script lang="ts" setup>
import SafeHtmlBox from '../editor/SafeHtmlBox.vue';

const props = defineProps<{
    html: string;
    title: string;
}>();
</script>
