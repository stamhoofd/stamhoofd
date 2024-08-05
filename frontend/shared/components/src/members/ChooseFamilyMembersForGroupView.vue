<template>
    <ExternalOrganizationContainer v-slot="{externalOrganization: groupOrganization}" :organization-id="group.organizationId" @update="setOrganization">
        <SaveView save-text="Doorgaan" :title="group.settings.name" @save="goNext">
            <p v-if="!checkout.isAdminFromSameOrganization" class="style-title-prefix">
                {{ groupOrganization!.name }}
            </p>
            <h1>Inschrijven voor {{ group.settings.name }}</h1>

            <STList>
                <RegisterItemCheckboxRow
                    v-for="member in family.members" 
                    :key="member.id" 
                    :member="member" 
                    :group="group" 
                    :group-organization="groupOrganization" 
                />
            </STList>
        </SaveView>
    </ExternalOrganizationContainer>
</template>

<script setup lang="ts">
import { useDismiss } from '@simonbackx/vue-app-navigation';
import { ExternalOrganizationContainer } from '@stamhoofd/components';
import { Group, Organization, PlatformFamily } from '@stamhoofd/structures';
import { computed } from 'vue';
import RegisterItemCheckboxRow from './components/group/RegisterItemCheckboxRow.vue';

const props = defineProps<{
    family: PlatformFamily,
    group: Group
}>();

const checkout = computed(() => props.family.checkout)
const dismiss = useDismiss();

function setOrganization(groupOrganization: Organization) {
    checkout.value.setDefaultOrganization(groupOrganization)
}

async function goNext() {
    await dismiss()

    // todo: go to cart
}

</script>
