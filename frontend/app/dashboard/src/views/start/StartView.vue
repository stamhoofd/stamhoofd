<template>
    <section class="st-view" data-testid="dashboard-start-view">
        <STNavigationBar :title="$t('%44')" />
        <main class="center">
            <aside v-copyable class="style-title-prefix">
                {{ $t('%44') }}
            </aside>

            <h1 data-testid="organization-name">
                {{ organization.name }}
                <span v-copyable class="title-suffix style-copyable">
                    {{ organization.uri }}
                </span>
            </h1>

            <p>{{ $t('%0') }}</p>

            <p v-if="!organization.active" class="error-box">
                {{ $t('%Gm') }}
            </p>
            <BillingWarningBox />

            <p v-if="$isPlatform">
                <a :href="$domains.getDocs('stappenplan-opstart-werkjaar')" target="_blank" class="button text selected">
                    <span class="icon book" />
                    <span>{{ $t('%8T') }}</span>
                </a>
            </p>

            <QuickActionsBox :quick-actions="quickActions" />

            <SetupStepsView v-if="$isPlatform && auth.hasFullAccess()" />
        </main>
    </section>
</template>

<script setup lang="ts">
import { useAuth } from '@stamhoofd/components/hooks/useAuth.ts';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import { useDashboardQuickActions } from '@stamhoofd/components/quick-actions/hooks/useDashboardQuickActions.ts';
import QuickActionsBox from '@stamhoofd/components/quick-actions/QuickActionsBox.vue';
import BillingWarningBox from '../dashboard/settings/packages/BillingWarningBox.vue';
import SetupStepsView from './SetupStepsView.vue';

const auth = useAuth();
const quickActions = useDashboardQuickActions();
const organization = useRequiredOrganization();

</script>
