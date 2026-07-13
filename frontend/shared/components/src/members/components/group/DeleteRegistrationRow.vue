<template>
    <STListItem class="right-stack">
        <template #left>
            <MemberIcon :member="registration.member" icon="red canceled" />
        </template>

        <h3 class="style-title-list">
            <span>{{ registration.member.patchedMember.name }}</span>
        </h3>

        <p class="style-description-small">
            {{ $t('%dm') }} {{ registration.registration.group.settings.name }}
        </p>

        <template #right>
            <p v-if="balance && (balance.amountOpen + balance.amountPaid + balance.amountPending !== 0)" class="style-price negative">
                {{ formatPrice(balance.amountOpen + balance.amountPaid + balance.amountPending) }}
            </p>

            <button class="button icon trash gray" type="button" @click.stop="deleteMe()" />
        </template>
    </STListItem>
</template>

<script setup lang="ts">
import type { RegisterCheckout, RegistrationWithPlatformMember } from '@stamhoofd/structures';
import { computed } from 'vue';
import MemberIcon from '../MemberIcon.vue';

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
