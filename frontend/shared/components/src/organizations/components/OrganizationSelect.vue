<template>
    <div class="input-icon-container icon arrow-down-small right gray" @click="selectOrganization">
        <div class="input selectable">
            {{ model?.name ?? '' }}
        </div>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { NavigationActions, SearchOrganizationView } from '@stamhoofd/components';
import { Organization } from '@stamhoofd/structures';

const model = defineModel<Organization | null>({
    required: true });

const present = usePresent();

async function selectOrganization() {
    await present({
        components: [
            new ComponentWithProperties(SearchOrganizationView, {
                title: $t('2a1a65d9-d04a-44f2-a86e-0d500f6186ee'),
                description: $t('6f707b06-382b-417f-b64a-59c7076a08cd'),
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
