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

            <EmailPreviewBox :email="email" />
        </main>
    </div>
</template>

<script lang="ts" setup>
import { EmailPreviewBox } from '@stamhoofd/components';
import { EmailPreview, EmailStatus } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = defineProps<{
    email: EmailPreview;
}>();

const title = computed(() => {
    return props.email.replacedSubject || $t('0f763bbf-f9fd-4213-a675-42396d1065e8');
});
</script>
