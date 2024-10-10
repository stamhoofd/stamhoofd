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
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { Organization } from '@stamhoofd/structures';

const model = defineModel<Organization | null>({
    required: true });

const present = usePresent();
const $t = useTranslate();

async function selectOrganization() {
    await present({
        components: [
            new ComponentWithProperties(SearchOrganizationView, {
                title: $t('Kies een organisatie'),
                description: $t('Dit is de organisatie die het totale bedrag zal aanrekenen aan de geselecteerde organisatie(s).'),
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
