<template>
    <LoadingViewTransition>
        <div v-if="!loading" class="st-view background">
            <STNavigationBar :title="$t(`%K5`)" />

            <main class="center">
                <h1>{{ $t('%K5') }}</h1>
                <p>{{ $t('%30') }}</p>

                <STList class="illustration-list">
                    <STListItem :selectable="true" class="left-center" @click="$navigate(Routes.Responsibilities)">
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
                </STList>

                <InternalAdminsBox />
                <ExternalAdminsBox />
            </main>
        </div>
    </LoadingViewTransition>
</template>

<script setup lang="ts">
import LoadingViewTransition from '#containers/LoadingViewTransition.vue';
import EditResponsibilitiesView from '#responsibilities/EditResponsibilitiesView.vue';
import { defineRoutes, useNavigate } from '@simonbackx/vue-app-navigation';
import ExternalAdminsBox from './ExternalAdminsBox.vue';
import { useAdmins } from './hooks/useAdmins';
import InternalAdminsBox from './InternalAdminsBox.vue';
import RolesView from './RolesView.vue';

const { loading, reload } = useAdmins();
reload(true)?.catch(console.error);

enum Routes {
    Roles = 'rollen',
    Responsibilities = 'functies',
}

defineRoutes([
    {
        url: Routes.Roles,
        name: 'roles',
        component: RolesView,
        present: 'popup',
    },
    {
        url: Routes.Responsibilities,
        present: 'popup',
        component: EditResponsibilitiesView,
    },
]);

const $navigate = useNavigate();

</script>
