<template>
    <section class="st-view">
        <STNavigationBar :title="$t('dashboard.start.title')" />
        <main class="center">
            <h1>
                {{ $t('dashboard.start.title') }}
            </h1>

            <p>{{ $t('dashboard.start.title-description') }}</p>

            <p class="info-box" v-if="STAMHOOFD.environment !== 'production'">Dit is een testomgeving</p>
            
            <SetupStepsView />
        </main>
    </section>
</template>

<script setup lang="ts">
import SetupStepsView from './SetupStepsView.vue';

</script>
