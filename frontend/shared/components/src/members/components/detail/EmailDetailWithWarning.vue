<template>
    <button v-if="emailWarningMessage" v-tooltip="emailWarningMessage" type="button" :class="{'style-copyable': canManageEmailAddress && emailWarningMessage}" class="email-detail" @click="onClickEmail">
        <span class="truncate">{{ email }} </span>
        <span class="icon warning inline-description" />
    </button>
    <component :is="tag" v-else v-copyable :class="{'email-detail': true, 'style-copyable': copyable}">
        <span class="truncate">{{ email }} </span>
        <span class="icon inline-description" />
    </component>
</template>

<script setup lang="ts">
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { EmailInformation } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useAuth, useEmailInformation, useEmailWarning } from '../../../hooks';
import EmailInformationView from '../../EmailInformationView.vue';

const props = withDefaults(defineProps<{
    tag?: string;
    email: string | null;
    copyable?: boolean;
}>(), {
    tag: 'span',
    copyable: true,
});

const email = computed(() => props.email);
const auth = useAuth();
const canManageEmailAddress = computed(() => auth.hasFullAccess() || auth.hasPlatformFullAccess());
const emailInformation = useEmailInformation(email);
const emailWarningMessage = useEmailWarning(emailInformation);
const present = usePresent();

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

<style scoped lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.email-detail {
    display: inline-grid;
    grid-template-columns: 1fr auto;
    gap: 3px;
}

.truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
