<template>
    <STListItem class="right-stack smartphone-wrap-left" :selectable="true">
        <p class="style-title-prefix-list flex">
            {{ email.fromName || email.fromAddress }}
        </p>
        <h3 class="style-title-list large">
            {{ email.replacedSubject || $t('0f763bbf-f9fd-4213-a675-42396d1065e8') }}
        </h3>
        <p v-if="email.snippet" class="style-description-small pre-wrap style-limit-lines" v-text="email.snippet" />

        <p v-if="email.sentAt" class="style-interactive-small">
            {{ formatDateTime(email.sentAt) }}
        </p>

        <template #right>
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script setup lang="ts">
import { EmailPreview, EmailWithRecipients } from '@stamhoofd/structures';

defineProps<{
    email: EmailPreview | EmailWithRecipients;
}>();

</script>
