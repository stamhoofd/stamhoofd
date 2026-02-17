<template>
    <button v-if="emailWarningMessage" v-tooltip="emailWarningMessage" type="button" :class="{'style-tooltip': canManageEmailAddress && emailWarningMessage}" class="st-email-address" @click="onClickEmail">
        <span class="truncate">{{ email }} </span>
        <span class="icon warning text-size" />
    </button>
    <span v-else v-copyable :class="{'st-email-address': true, 'style-copyable': copyable}">
        <span class="truncate">{{ email }} </span>
        <span class="icon text-size" />
    </span>
</template>

<script setup lang="ts">
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { EmailInformation } from '@stamhoofd/structures';
import { computed } from 'vue';
import EmailInformationView from './EmailAddressInformationView.vue';
import { useEmailInformation } from '../hooks/useEmailInformation';
import { useEmailWarning } from '../hooks/useEmailWarning';
import { useAuth } from '../hooks/useAuth';

const props = withDefaults(defineProps<{
    email: string | null;
    copyable?: boolean;
}>(), {
    copyable: true,
});
const auth = useAuth();
const present = usePresent();

const email = computed(() => props.email);
const canManageEmailAddress = computed(() => auth.hasFullAccess() || auth.hasPlatformFullAccess());
const emailInformation = useEmailInformation(email);
const emailWarningMessage = useEmailWarning(emailInformation);

function onClickEmail() {
    if (canManageEmailAddress.value && emailInformation.value) {
        presentEmailInformation(emailInformation.value).catch(console.error);
    }
}

async function presentEmailInformation(emailInformation: EmailInformation) {
    const component = new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(EmailInformationView, {
            emailInformation,
        }),
    });

    await present({
        components: [component],
        modalDisplayStyle: 'popup',
    });
}

</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.st-email-address {
    display: inline-grid;
    grid-template-columns: 1fr auto;
    gap: 3px;

    .truncate {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
}

</style>
