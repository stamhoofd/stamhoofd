<template>
    <nav class="st-view">
        <main>
            <STList>
                <STListItem v-for="option in options" :key="option.id" :selectable="true" element-name="button">
                    <template #left>
                        <OrganizationAvatar :organization="option.organization" />
                    </template>
                    <h1 class="style-title-list">
                        {{ option.organization.name }}
                    </h1>
                    <p class="style-description">Ledenportaal</p>
                </STListItem>
            </STList>
        </main>
    </nav>
</template>

<script setup lang="ts">
import { unref } from 'vue';
import { useOrganization } from './VueGlobalHelper';
import OrganizationAvatar from './OrganizationAvatar.vue';

const $organization = unref(useOrganization());

const options = $organization ? [
    {
        id: 'registration',
        app: 'registration',
        organization: $organization
    },
    {
        id: 'dashboard',
        app: 'dashboard',
        organization: $organization
    }
] : [];

</script>