<template>
    <LoadingViewTransition>
        <div v-if="!loading" class="st-view background">
            <STNavigationBar :title="$t(`%K5`)" />

            <main class="center">
                <h1>{{ $t('%K5') }}</h1>
                <p>{{ $t('%30') }}</p>

                <STList class="illustration-list">
                    <STListItem v-if="showInternalAdmins" :selectable="true" class="left-center" @click="$navigate(Routes.Responsibilities)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/admin-role.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('%YW') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('%YX') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                    <STListItem v-else :selectable="true" class="left-center" @click="$navigate(Routes.Roles)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/admin-role.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('%1VS') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('%1a7') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>

                <InternalAdminsBox v-if="showInternalAdmins" />
                <ExternalAdminsBox />
            </main>
        </div>
    </LoadingViewTransition>
</template>

<script setup lang="ts">
import LoadingViewTransition from '#containers/LoadingViewTransition.vue';

import { defineRoutes, useNavigate } from '@simonbackx/vue-app-navigation';
import ExternalAdminsBox from './ExternalAdminsBox.vue';
import { useAdmins } from './hooks/useAdmins';
import { useShowInternalAdmins } from './hooks/useShowInternalAdmins';
import InternalAdminsBox from './InternalAdminsBox.vue';

const { loading } = useAdmins({ forceLoadOnMount: true });
const showInternalAdmins = useShowInternalAdmins();

enum Routes {
    Roles = 'rollen',
    Responsibilities = 'functies',
}

defineRoutes([
    {
        url: Routes.Roles,
        name: 'roles',
        component: async () => (await import('./RolesView.vue')).default,
        present: 'popup',
    },
    {
        url: Routes.Responsibilities,
        present: 'popup',
        component: async () => (await import('#responsibilities/EditResponsibilitiesView.vue')).default,
    },
]);

const $navigate = useNavigate();

</script>
