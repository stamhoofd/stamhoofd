<template>
    <component :is="tag" v-if="emailWarningMessage" v-tooltip="emailWarningMessage" :class="{'style-copyable': canManageEmailAddress && emailWarningMessage}" class="email-detail" @click="onClickEmail">
        <span class="truncate">{{ email }}</span>
        <span class="icon warning inline-description" />
    </component>
    <component :is="tag" v-else class="email-detail">
        <span v-copyable class="truncate">{{ email }}</span>
        <span class="icon inline-description" />
    </component>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useManageMemberEmail } from '../../composables/useManageMemberEmail';

const props = withDefaults(defineProps<{
    tag?: string;
    email: string | null;
}>(), {
    tag: 'span',
});

const email = computed(() => props.email);
const { emailWarningMessage, canManageEmailAddress, presentEmailInformation } = useManageMemberEmail(email);

function onClickEmail() {
    if (canManageEmailAddress.value && emailWarningMessage.value) {
        presentEmailInformation().catch(console.error);
    }
}
</script>

<style scoped lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.email-detail {
    display: grid !important;
    grid-template-columns: 1fr auto;
}

.truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
