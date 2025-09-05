<template>
    <div class="st-menu st-view">
        <main>
            <h1>{{ platform.config.name }}</h1>

            <button type="button" class="button menu-button" :class="{ selected: checkRoute(Routes.Members) }" @click="navigate(Routes.Members)">
                <span class="icon group" />
                <span>
                    {{ $t("Leden") }}
                </span>
            </button>

            <button type="button" class="button menu-button" :class="{ selected: checkRoute(Routes.Registrations) }" @click="navigate(Routes.Registrations)">
                <span class="icon group" />
                <span>
                    {{ $t("Inschrijvingen") }}
                </span>
            </button>
        </main>
    </div>
</template>

<script setup lang="ts">
import { defineRoutes, useCheckRoute, useNavigate } from '@simonbackx/vue-app-navigation';
import { MembersTableView, RegistrationsTableView, usePlatform } from '@stamhoofd/components';

enum Routes {
    Members = 'members',
    Registrations = 'registrations',
}

defineRoutes([
    {
        url: 'leden',
        name: Routes.Members,
        show: 'detail',
        component: MembersTableView,
        isDefault: {
            properties: {},
        },
    },
    {
        url: 'inschrijvingen',
        name: Routes.Registrations,
        show: 'detail',
        component: RegistrationsTableView,
    },
]);

const checkRoute = useCheckRoute();
const navigate = useNavigate();
const platform = usePlatform();
</script>
