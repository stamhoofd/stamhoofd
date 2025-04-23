<template>
    <STListItem class="right-stack">
        <template #left>
            <GroupIconWithWaitingList :group="registration.group" icon="canceled" />
        </template>

        <h3 class="style-title-list">
            <span>{{ registration.member.name }}</span>
        </h3>

        <p class="style-description-small">
            {{ $t('Uitschrijven voor') }} {{ registration.group.settings.name }}
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
import { RegisterCheckout, RegistrationWithMember } from '@stamhoofd/structures';
import { computed } from 'vue';
import GroupIconWithWaitingList from './GroupIconWithWaitingList.vue';

const props = withDefaults(
    defineProps<{
        registration: RegistrationWithMember;
        checkout: RegisterCheckout;
    }>(),
    {
    },
);

async function deleteMe() {
    props.checkout.unremoveRegistration(props.registration);
}

const balance = computed(() => {
    return props.registration.balances.find(b => b.organizationId === props.registration.organizationId);
});

</script>
