<template>
    <STListItem v-color="!organization ? (email.organization?.meta.color) : null" class="right-stack" :selectable="true">
        <template v-if="!organization && email.organization" #left>
            <OrganizationAvatar :organization="email.organization" />
        </template>
        <template v-else-if="!organization && !email.organizationId" #left>
            <PlatformOrganizationAvatar />
        </template>

        <p class="style-title-prefix-list flex">
            {{ !organization && email.organization && email.fromName && (email.organization.name !== email.fromName) ? `${email.organization.name} (${email.fromName || email.organization?.name || email.fromAddress })` : email.fromName || email.organization?.name || email.fromAddress }}
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
import { PlatformOrganizationAvatar, OrganizationAvatar, useOrganization } from '@stamhoofd/components';
import { EmailPreview, EmailWithRecipients } from '@stamhoofd/structures';

defineProps<{
    email: EmailPreview | EmailWithRecipients;
}>();
const organization = useOrganization();

</script>
