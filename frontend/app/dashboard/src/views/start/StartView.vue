<template>
    <section class="st-view start-view">
        <STNavigationBar :title="$t('dashboard.start.title')" />
        <main class="center">
            <h1>
                {{ $t('dashboard.start.title') }}
            </h1>

            <p>{{ $t('dashboard.start.title-description') }}</p>

            <SetupStepsView/>
        </main>
    </section>
</template>

<script setup lang="ts">
import { useUrl } from '@simonbackx/vue-app-navigation';
import { onActivated } from 'vue';
import SetupStepsView from './SetupStepsView.vue';

const urlHelpers = useUrl();

onActivated(() => {
    console.log('Start view mounted');
    urlHelpers.setTitle('Beheerdersportaal');
});
</script>

<style lang="scss" scoped>
    .start-view {
    }
</style>
