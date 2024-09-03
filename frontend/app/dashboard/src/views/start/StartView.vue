<template>
    <section class="st-view">
        <STNavigationBar :title="$t('dashboard.start.title')" />
        <main class="center">
            <h1>
                {{ $t('dashboard.start.title') }}
            </h1>

            <p>{{ $t('dashboard.start.title-description') }}</p>

            <p>
                <a :href="$domains.getDocs('stappenplan-opstart-werkjaar')" target="_blank" class="button text selected">
                    <span class="icon book" />
                    <span>Stappenplan opstart werkjaar</span>
                </a>
            </p>
            
            <SetupStepsView v-if="auth.hasFullAccess()" />
        </main>
    </section>
</template>

<script setup lang="ts">
import { useAuth } from '@stamhoofd/components';
import SetupStepsView from './SetupStepsView.vue';

const auth = useAuth();

</script>
