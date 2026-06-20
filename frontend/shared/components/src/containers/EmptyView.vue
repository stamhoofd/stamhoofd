<template>
    <div class="st-view">
        <STNavigationBar />
        <main>
            <h1>
                {{ title }}
            </h1>
            <p>
                {{ description }}
            </p>
        </main>
    </div>
</template>

<script setup lang="ts">
import STNavigationBar from '#navigation/STNavigationBar.vue';

defineProps<{
    title: string;
    description: string;
}>();
</script>
