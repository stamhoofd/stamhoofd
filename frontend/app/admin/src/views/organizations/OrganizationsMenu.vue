<template>
    <div class="st-menu st-view">
        <STNavigationBar title="Groepen" />

        <main>
            <h1>Groepen</h1>

            <div class="container">

                <button type="button" class="button menu-button" :class="{ selected: checkRoute(Routes.All) }">
                    <span class="icon group" />
                    <span>
                        Alle groepen
                    </span>
                </button>

            </div>

            <hr>

            <div class="container">
                <button type="button" class="button menu-button">
                    <span class="icon label" />
                    <span>
                        Tags
                    </span>
                    <span class="icon gray settings right-icon" />
                </button>

                <button type="button" class="button menu-button sub-button">
                    <span class="icon" />
                    <span>
                        Oost-Vlaanderen
                    </span>
                </button>

            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
import { defineRoutes, useCheckRoute } from '@simonbackx/vue-app-navigation';
import OrganizationsTableView from './OrganizationsTableView.vue';
import { ComponentOptions } from 'vue';

enum Routes {
    All = 'all',
    Tag = 'tag'
}

defineRoutes([
    {
        url: 'allemaal',
        name: Routes.All,
        show: 'detail',
        component: OrganizationsTableView as unknown as ComponentOptions,
        isDefault: {
            properties: {}
        }
    }
])
const checkRoute = useCheckRoute();

</script>
