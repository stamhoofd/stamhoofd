<template>
    <ExternalOrganizationContainer v-slot="{externalOrganization: groupOrganization}" :organization-id="group.organizationId" @update="setOrganization">
        <SaveView save-text="Doorgaan" :title="group.settings.name" @save="goNext">
            <p v-if="!checkout.isAdminFromSameOrganization" class="style-title-prefix">
                {{ groupOrganization!.name }}
            </p>
            <h1>Inschrijven voor {{ group.settings.name }}</h1>

            <p v-if="hasNoMembers" class="info-box">
                {{ $t('d5e39906-8c0b-4006-bab5-96827f8daa53') }}
            </p>

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
import { ExternalOrganizationContainer, GlobalEventBus } from '@stamhoofd/components';
import { Group, Organization, PlatformFamily } from '@stamhoofd/structures';
import { computed } from 'vue';
import RegisterItemCheckboxRow from './components/group/RegisterItemCheckboxRow.vue';

const props = defineProps<{
    family: PlatformFamily;
    group: Group;
}>();

const hasNoMembers = computed(() => props.family.members.length === 0);

const checkout = computed(() => props.family.checkout);
const dismiss = useDismiss();

function setOrganization(groupOrganization: Organization) {
    checkout.value.setDefaultOrganization(groupOrganization);
}

async function goNext() {
    await dismiss();

    if (!checkout.value.cart.isEmpty) {
        await GlobalEventBus.sendEvent('selectTabByName', 'mandje');
    }
}

</script>
