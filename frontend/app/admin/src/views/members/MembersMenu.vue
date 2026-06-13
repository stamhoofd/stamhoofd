<template>
    <div class="st-menu st-view">
        <main>
            <h1>{{ platform.config.name }}</h1>

            <button type="button" class="button menu-button" :class="{ selected: checkRoute(Routes.Members) }" @click="navigate(Routes.Members)">
                <span class="icon group" />
                <span>
                    {{ $t("%1EH") }}
                </span>
            </button>

            <button type="button" class="button menu-button" :class="{ selected: checkRoute(Routes.Registrations) }" @click="navigate(Routes.Registrations)">
                <span class="icon edit" />
                <span>
                    {{ $t("%1EI") }}
                </span>
            </button>
            
            <button v-if="showMemberships" type="button" class="button menu-button" :class="{ selected: checkRoute(Routes.PlatformMemberships) }" @click="navigate(Routes.PlatformMemberships)">
                <span class="icon membership-filled" />
                <span>
                    {{ $t("%1Nt") }}
                </span>
            </button>
        </main>
    </div>
</template>

<script setup lang="ts">
import { defineRoutes, useCheckRoute, useNavigate } from '@simonbackx/vue-app-navigation';
import { useAuth } from '@stamhoofd/components/hooks/useAuth';
import { usePlatform } from '@stamhoofd/components/hooks/usePlatform.ts';



import { computed } from 'vue';

enum Routes {
    Members = 'members',
    Registrations = 'registrations',
    PlatformMemberships = 'platformMemberships',
}

defineRoutes([
    {
        url: 'leden',
        name: Routes.Members,
        show: 'detail',
        component: async () => (await import('@stamhoofd/components/members/MembersTableView.vue')).default,
        isDefault: {
            properties: {},
        },
    },
    {
        url: 'inschrijvingen',
        name: Routes.Registrations,
        show: 'detail',
        component: async () => (await import('@stamhoofd/components/registrations/RegistrationsTableView.vue')).default,
    },
    {
        url: 'aansluitingen',
        name: Routes.PlatformMemberships,
        show: 'detail',
        component: async () => (await import('@stamhoofd/components/platform-memberships/PlatformMembershipsTableView.vue')).default,
    },
]);

const checkRoute = useCheckRoute();
const navigate = useNavigate();
const platform = usePlatform();
const auth = useAuth();

const showMemberships = computed(() => {
    return auth.hasPlatformFullAccess();
})
</script>
