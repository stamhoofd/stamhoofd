<template>
    <LoadingViewTransition>
        <div v-if="!loading" class="st-view background">
            <STNavigationBar :title="$t(`844333d1-ba08-4d37-bdf3-eae024c87ff3`)" />

            <main class="center">
                <h1>{{ $t('05dff2a6-72fa-4054-ab7f-8e04dc7c7ed9') }}</h1>
                <p>{{ $t('ac3b2a14-e029-404c-9fe1-2aab4279a3ac') }}</p>

                <STList class="illustration-list">
                    <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.Responsibilities)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/admin-role.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('104d3831-38fb-4e1e-89f2-cbd5d538faa3') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('dcfeea1e-7841-4dbd-a187-84aed37f0790') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>

                <InternalAdminsBox />
                <ExternalAdminsBox />
            </main>
        </div>
    </LoadingViewTransition>
</template>

<script setup lang="ts">
import { defineRoutes, useNavigate } from '@simonbackx/vue-app-navigation';
import { EditResponsibilitiesView, LoadingViewTransition } from '@stamhoofd/components';
import { ComponentOptions } from 'vue';
import ExternalAdminsBox from './ExternalAdminsBox.vue';
import { useAdmins } from './hooks/useAdmins';
import InternalAdminsBox from './InternalAdminsBox.vue';
import RolesView from './RolesView.vue';

const { loading, reload } = useAdmins();
reload(true);

enum Routes {
    Roles = 'rollen',
    Responsibilities = 'functies',
}

defineRoutes([
    {
        url: Routes.Roles,
        name: 'roles',
        component: RolesView as ComponentOptions,
        present: 'popup',
    },
    {
        url: Routes.Responsibilities,
        present: 'popup',
        component: EditResponsibilitiesView as ComponentOptions,
    },
]);

const $navigate = useNavigate();

</script>
