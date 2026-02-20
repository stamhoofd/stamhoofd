<template>
    <div v-color="email.organization?.meta.color" class="st-view">
        <STNavigationBar :title="title" />

        <main class="center">
            <p class="style-title-prefix flex">
                {{ !organization && email.organization && email.fromName && (email.organization.name !== email.fromName) ? `${email.organization.name} (${email.fromName || email.organization?.name || email.fromAddress })` : email.fromName || email.organization?.name || email.fromAddress }}
            </p>
            <h1>{{ title }}</h1>

            <ScrollableSegmentedControl v-if="email.recipients.length > 1" v-model="selectedRecipient" :items="props.email.recipients" :labels="props.email.recipients.map(r => r.member?.firstName ?? (r.id))" />
            <EmailPreviewBox :email="email" :recipient="selectedRecipient" :allow-clicks="true" :web-version="true" />

            <hr>
            <STList>
                <STListItem v-if="email.sentAt && email.status === EmailStatus.Sent">
                    <template #left>
                        <span class="icon date-time" />
                    </template>

                    <h2 class="style-title-list">
                        {{ formatDateTime(email.sentAt) }}
                    </h2>
                </STListItem>

                <STListItem v-if="email.fromName">
                    <template #left>
                        <span class="icon email small" />
                    </template>

                    <h2 class="style-title-list">
                        {{ email.fromAddress }}
                    </h2>
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { useOrganization, EmailPreviewBox, ScrollableSegmentedControl } from '@stamhoofd/components';
import { EmailStatus, EmailWithRecipients } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

const props = defineProps<{
    email: EmailWithRecipients;
}>();
const organization = useOrganization();

const title = computed(() => {
    return props.email.replacedSubject || $t('0f763bbf-f9fd-4213-a675-42396d1065e8');
});

const selectedRecipientId = ref<string | null>(null);
const selectedRecipient = computed({
    get: () => {
        if (!selectedRecipientId.value) {
            return props.email.recipients[0] ?? null;
        }
        return props.email.recipients.find(r => r.id === selectedRecipientId.value) ?? props.email.recipients[0] ?? null;
    },
    set: (val) => {
        selectedRecipientId.value = val?.id ?? null;
    },
});

</script>
