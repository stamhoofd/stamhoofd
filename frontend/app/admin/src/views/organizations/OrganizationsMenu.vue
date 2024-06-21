<template>
    <div class="st-menu st-view">
        <STNavigationBar title="Groepen" />

        <main>
            <h1>Groepen</h1>

            <div class="container">
                <button type="button" class="button menu-button" :class="{ selected: checkRoute(Routes.All) }" @click="navigate(Routes.All)">
                    <span class="icon group" />
                    <span>
                        Alle groepen
                    </span>
                </button>
            </div>

            <hr>

            <div class="container">
                <button type="button" class="button menu-button" :class="{ selected: checkRoute(Routes.Tags) }" @click="navigate(Routes.Tags)">
                    <span class="icon label" />
                    <span>
                        Tags
                    </span>
                    <span class="icon gray settings right-icon" />
                </button>

                <button v-for="tag of tags" :key="tag.id" type="button" class="button menu-button sub-button">
                    <span class="icon" />
                    <span>
                        {{ tag.name }}
                    </span>
                </button>
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
import { defineRoutes, useCheckRoute, useNavigate } from '@simonbackx/vue-app-navigation';
import { ComponentOptions, computed } from 'vue';
import OrganizationsTableView from './OrganizationsTableView.vue';
import EditOrganizationTagsView from './tags/EditOrganizationTagsView.vue';
import { usePlatform } from '@stamhoofd/components';

enum Routes {
    All = 'all',
    Tag = 'tag',
    Tags = 'tags'
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
    },
    {
        url: 'tags',
        name: Routes.Tags,
        present: 'popup',
        component: EditOrganizationTagsView as unknown as ComponentOptions,
        isDefault: {
            properties: {}
        }
    }
])
const checkRoute = useCheckRoute();
const navigate = useNavigate();
const platform = usePlatform();
const tags = computed(() => platform.value.config.tags);

</script>
