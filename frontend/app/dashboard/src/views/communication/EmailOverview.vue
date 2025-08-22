<template>
    <div class="st-view">
        <STNavigationBar :title="title" />

        <main class="center">
            <p v-if="status" :class="'style-title-prefix ' + (status.theme ?? '')">
                <span>{{ status.text }}</span><span v-if="status.icon" :class="'icon small ' + status.icon" />
            </p>
            <h1>{{ title }}</h1>

            <template v-if="email.emailErrors && props.email.status === EmailStatus.Failed">
                <div v-for="(error, index) in email.emailErrors.errors" :key="index" class="error-box">
                    {{ error.getHuman() }}
                </div>
            </template>

            <template v-if="email.recipientsErrors && props.email.recipientsStatus === EmailRecipientsStatus.NotCreated">
                <div v-for="(error, index) in email.recipientsErrors.errors" :key="index" class="error-box">
                    {{ error.getHuman() }}
                </div>
            </template>

            <STList>
                <STListItem v-if="props.email.sentAt">
                    <template #left>
                        <span class="icon clock" />
                    </template>

                    <h2 class="style-title-list">
                        {{ $t('39a982c1-916a-43da-857d-a15f67c96c62') }}: {{ formatDateTime(props.email.sentAt) }}
                    </h2>
                </STListItem>
                <STListItem v-else>
                    <template #left>
                        <span class="icon clock" />
                    </template>

                    <h2 class="style-title-list">
                        {{ $t('52961dd4-be19-47a1-abe6-1e3c34e8157c') }}: {{ formatDateTime(props.email.createdAt) }}
                    </h2>
                </STListItem>

                <STListItem v-if="props.email.fromName || props.email.fromAddress">
                    <template #left>
                        <span class="icon user" />
                    </template>

                    <h2 class="style-title-list">
                        {{ $t('a4a8cb20-8351-445a-bb59-91867679eead') }}: {{ props.email.fromName || props.email.fromAddress }}
                    </h2>
                    <p v-if="props.email.fromName" class="style-description-small">
                        {{ props.email.fromAddress }}
                    </p>
                </STListItem>

                <STListItem v-if="props.email.recipientCount" :selectable="true" class="right-stack">
                    <template #left>
                        <span class="icon group" />
                    </template>

                    <h2 class="style-title-list">
                        {{ $t('ddc9d375-901c-4b2d-a257-0449083a9bfd') }}
                    </h2>

                    <p v-if="props.email.failedCount + props.email.softFailedCount > 1" class="style-description-small">
                        {{ $t('{count} emails konden niet worden verzonden', {
                            count: props.email.failedCount + props.email.softFailedCount
                        }) }}
                    </p>
                    <p v-else-if="props.email.failedCount + props.email.softFailedCount === 1" class="style-description-small">
                        {{ $t('Eén email kon niet worden verzonden') }}
                    </p>
                    <p v-else-if="props.email.succeededCount && props.email.recipientCount !== props.email.succeededCount" class="style-description-small">
                        {{ $t('Waarvan reeds {count} verzonden', { count: props.email.succeededCount }) }}
                    </p>

                    <template #right>
                        <p v-if="props.email.succeededCount && props.email.succeededCount !== props.email.recipientCount" class="style-description-small">
                            {{ formatInteger(props.email.succeededCount) }} / {{ formatInteger(props.email.recipientCount) }}
                        </p>
                        <p v-else class="style-description-small">
                            {{ formatInteger(props.email.recipientCount) }}
                        </p>
                        <span class="icon small arrow-right-small" />
                    </template>
                </STListItem>
            </STList>

            <div v-if="replacedHtml" class="email-preview-box">
                <SafeHtmlBox :html="replacedHtml" />
            </div>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { SafeHtmlBox } from '@stamhoofd/components';
import { EmailPreview, EmailRecipientsStatus, EmailStatus, replaceEmailHtml } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useEmailStatus } from './hooks/useEmailStatus';

const props = defineProps<{
    email: EmailPreview;
}>();

const title = computed(() => {
    return props.email.subject || $t('0f763bbf-f9fd-4213-a675-42396d1065e8');
});

const getEmailStatus = useEmailStatus();
const status = computed(() => {
    return getEmailStatus(props.email);
});

const replacedHtml = computed(() => {
    if (!props.email.html) {
        return props.email.html;
    }
    return replaceEmailHtml(props.email.html, props.email.exampleRecipient?.replacements || []);
});
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.email-preview-box {
    margin: 0 auto;
    padding: 30px;
    background-color: $color-background-shade;
    border-radius: $border-radius;
    margin: 0 calc(-1 * var(--st-horizontal-padding, 40px));
    overflow: hidden;
    margin-top: 20px;

    @media (max-width: 600px) {
        padding: 40px 15px;
    }
}

</style>
