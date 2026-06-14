<template>
    <div class="input-icon-container icon arrow-down-small right gray" @click="selectOrganization">
        <div class="input selectable">
            {{ model?.name ?? '' }}
        </div>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '#containers/AsyncComponent.ts';
import type { NavigationActions } from '#types/NavigationActions.ts';

import type { Organization } from '@stamhoofd/structures';

const model = defineModel<Organization | null>({
    required: true });

const present = usePresent();

async function selectOrganization() {
    await present({
        components: [
            AsyncComponent(() => import('#members/SearchOrganizationView.vue'), {
                title: $t('%6w'),
                description: $t('%6x'),
                selectOrganization: async (organization: Organization, navigation: NavigationActions) => {
                    model.value = organization;
                    await navigation.pop();
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}
</script>
