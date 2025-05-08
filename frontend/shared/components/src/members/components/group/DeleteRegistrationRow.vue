<template>
    <STListItem class="right-stack">
        <template #left>
            <GroupIconWithWaitingList :group="registration.registration.group" icon="canceled" />
        </template>

        <h3 class="style-title-list">
            <span>{{ registration.member.patchedMember.name }}</span>
        </h3>

        <p class="style-description-small">
            {{ $t('3b62fa55-becc-4ffb-b15d-f64528033953') }} {{ registration.registration.group.settings.name }}
        </p>

        <template #right>
            <p v-if="balance" class="style-price">
                {{ formatPrice(balance.amountOpen + balance.amountPaid + balance.amountPending) }}
            </p>

            <button class="button icon trash gray" type="button" @click.stop="deleteMe()" />
        </template>
    </STListItem>
</template>

<script setup lang="ts">
import { RegisterCheckout, RegistrationWithPlatformMember } from '@stamhoofd/structures';
import { computed } from 'vue';
import GroupIconWithWaitingList from './GroupIconWithWaitingList.vue';

const props = withDefaults(
    defineProps<{
        registration: RegistrationWithPlatformMember;
        checkout: RegisterCheckout;
    }>(),
    {
    },
);

async function deleteMe() {
    props.checkout.unremoveRegistration(props.registration);
}

const balance = computed(() => {
    return props.registration.registration.balances.find(b => b.organizationId === props.registration.registration.organizationId);
});

</script>
