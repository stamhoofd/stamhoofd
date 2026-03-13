<template>
    <ExternalOrganizationContainer v-slot="{externalOrganization: groupOrganization}" :organization-id="group.organizationId" @update="setOrganization">
        <SaveView :save-text="$t('%16p')" :title="group.settings.name" @save="goNext">
            <p v-if="!checkout.isAdminFromSameOrganization" class="style-title-prefix">
                {{ groupOrganization!.name }}
            </p>
            <h1>{{ $t('%dh') }} {{ group.settings.name }}</h1>

            <p v-if="hasNoMembers" class="info-box">
                {{ $t('%AI') }}
            </p>

            <STList>
                <RegisterItemCheckboxRow v-for="member in family.members" :key="member.id" :member="member" :group="group" :group-organization="groupOrganization" />
            </STList>
        </SaveView>
    </ExternalOrganizationContainer>
</template>

<script setup lang="ts">
import { useDismiss } from '@simonbackx/vue-app-navigation';
import ExternalOrganizationContainer from '#containers/ExternalOrganizationContainer.vue';
import { GlobalEventBus } from '#EventBus.ts';
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
        await GlobalEventBus.sendEvent('selectTabById', 'cart');
    }
}

</script>
