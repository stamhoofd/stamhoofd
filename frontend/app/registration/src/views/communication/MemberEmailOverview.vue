<template>
    <div class="st-view">
        <STNavigationBar :title="title" />

        <main class="center">
            <p class="style-title-prefix flex">
                {{ email.fromName || email.fromAddress }}
            </p>
            <h1>{{ title }}</h1>

            <STList>
                <STListItem v-if="email.sentAt && email.status === EmailStatus.Sent">
                    <template #left>
                        <span class="icon clock" />
                    </template>

                    <h2 class="style-title-list">
                        {{ $t('39a982c1-916a-43da-857d-a15f67c96c62') }}: {{ formatDateTime(email.sentAt) }}
                    </h2>
                </STListItem>

                <STListItem v-if="email.fromName || email.fromAddress">
                    <template #left>
                        <span class="icon user" />
                    </template>

                    <h2 class="style-title-list">
                        {{ $t('a4a8cb20-8351-445a-bb59-91867679eead') }}: {{ email.fromName || email.fromAddress }}
                    </h2>
                    <p v-if="email.fromName" class="style-description-small">
                        {{ email.fromAddress }}
                    </p>
                </STListItem>
            </STList>

            <ScrollableSegmentedControl v-if="email.recipients.length > 1" v-model="selectedRecipient" :items="props.email.recipients" :labels="props.email.recipients.map(r => r.firstName ?? r.memberId ?? r.id)" />
            <EmailPreviewBox :email="email" :recipient="selectedRecipient" />
        </main>
    </div>
</template>

<script lang="ts" setup>
import { EmailPreviewBox, ScrollableSegmentedControl } from '@stamhoofd/components';
import { EmailStatus, EmailWithRecipients } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

const props = defineProps<{
    email: EmailWithRecipients;
}>();

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
