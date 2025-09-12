<template>
    <div class="st-menu st-view">
        <main>
            <h1>{{ platform.config.name }}</h1>

            <button type="button" class="button menu-button" :class="{ selected: checkRoute(Routes.Members) }" @click="navigate(Routes.Members)">
                <span class="icon group" />
                <span>
                    {{ $t("19da8d23-acea-43c2-bfdd-742447ca57f1") }}
                </span>
            </button>

            <button type="button" class="button menu-button" :class="{ selected: checkRoute(Routes.Registrations) }" @click="navigate(Routes.Registrations)">
                <span class="icon group" />
                <span>
                    {{ $t("3f4c9896-7f02-4b49-ad29-2d363a8af71f") }}
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
