<template>
    <section class="st-view">
        <STNavigationBar :title="$t('d5d2e25f-588e-496e-925f-f7e375c3888a')" />
        <main class="center">
            <aside v-copyable class="style-title-prefix">
                {{ $t('d5d2e25f-588e-496e-925f-f7e375c3888a') }}
            </aside>

            <h1 data-testid="organization-name">
                {{ organization.name }}
                <span v-copyable class="title-suffix style-copyable">
                    {{ organization.uri }}
                </span>
            </h1>

            <p>{{ $t('5dbc2f08-f2d0-43bc-973d-b789077ca3ad') }}</p>

            <p v-if="!organization.active" class="error-box">
                {{ $t('8ccdb08d-3127-4fc7-ba15-5a0af262bcc8') }}
            </p>

            <p>
                <a :href="$domains.getDocs('stappenplan-opstart-werkjaar')" target="_blank" class="button text selected">
                    <span class="icon book" />
                    <span>{{ $t('57491b1b-a306-479e-9bc0-f0d4839a7f5c') }}</span>
                </a>
            </p>

            <QuickActionsBox :quick-actions="quickActions" />

            <SetupStepsView v-if="auth.hasFullAccess()" />
        </main>
    </section>
</template>

<script setup lang="ts">
import { QuickActionsBox, useAuth, useRequiredOrganization } from '@stamhoofd/components';
import { useDashboardQuickActions } from '@stamhoofd/components/src/quick-actions/hooks/useDashboardQuickActions';
import SetupStepsView from './SetupStepsView.vue';

const auth = useAuth();
const quickActions = useDashboardQuickActions();
const organization = useRequiredOrganization();

</script>
