<template>
    <STListItem class="right-stack">
        <template #left>
            <GroupIcon :group="registration.group" icon="canceled" />
        </template>

        <h3 class="style-title-list">
            <span>{{ registration.member.name }}</span>
        </h3>

        <p class="style-description-small">
            Uitschrijven voor {{ registration.group.settings.name }}
        </p>
        
        <footer>
            <p class="style-price">
                Terug: {{ formatPrice(registration.price) }}
            </p>
        </footer>

        <template #right>
            <button class="button icon trash gray" type="button" @click.stop="deleteMe()" />
        </template>
    </STListItem>
</template>


<script setup lang="ts">
import { RegisterCheckout, RegistrationWithMember } from '@stamhoofd/structures';
import GroupIcon from './GroupIcon.vue';

const props = withDefaults(
    defineProps<{
        registration: RegistrationWithMember;
        checkout: RegisterCheckout;
    }>(),
    {
    }
);

async function deleteMe() {
    props.checkout.unremoveRegistration(props.registration)
}

</script>
