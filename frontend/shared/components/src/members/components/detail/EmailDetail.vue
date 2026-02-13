<template>
    <dd v-if="emailWarningMessage" :class="{'style-copyable': canManageEmailAddress}" @click="presentEmailInformation">
        {{ email }}
        <EmailWarningMessage :message="emailWarningMessage" />
    </dd>
    <dd v-else v-copyable>
        {{ email }}
        <EmailWarningMessage :message="emailWarningMessage" />
    </dd>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useManageMemberEmail } from '../../composables/useManageMemberEmail';
import EmailWarningMessage from '../detail/EmailWarningMessage.vue';

const props = defineProps<{
    email: string | null;
}>();

const email = computed(() => props.email);
const { emailWarningMessage, canManageEmailAddress, presentEmailInformation } = useManageMemberEmail(email);
</script>
