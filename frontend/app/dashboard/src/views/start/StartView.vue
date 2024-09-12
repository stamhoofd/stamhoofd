<template>
    <section class="st-view">
        <STNavigationBar :title="$t('d5d2e25f-588e-496e-925f-f7e375c3888a')" />
        <main class="center">
            <h1>
                {{ $t('d5d2e25f-588e-496e-925f-f7e375c3888a') }}
            </h1>

            <p>{{ $t('5dbc2f08-f2d0-43bc-973d-b789077ca3ad') }}</p>

            <p>
                <a :href="$domains.getDocs('stappenplan-opstart-werkjaar')" target="_blank" class="button text selected">
                    <span class="icon book" />
                    <span>Stappenplan opstart werkjaar</span>
                </a>
            </p>

            <QuickActionsBox :quick-actions="quickActions" />

            <SetupStepsView v-if="auth.hasFullAccess()" />
        </main>
    </section>
</template>

<script setup lang="ts">
import { QuickActionsBox, useAuth } from '@stamhoofd/components';
import { useDashboardQuickActions } from '@stamhoofd/components/src/quick-actions/hooks/useDashboardQuickActions';
import SetupStepsView from './SetupStepsView.vue';

const auth = useAuth();
const quickActions = useDashboardQuickActions()

</script>
