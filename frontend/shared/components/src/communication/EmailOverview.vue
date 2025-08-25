<template>
    <div class="st-view">
        <STNavigationBar :title="title" />

        <main class="center">
            <p v-if="status" :class="'style-title-prefix flex ' + (status.theme ?? '')">
                <span>{{ status.text }}</span>
                <ProgressRing v-if="status.progress !== undefined" :radius="7" :opacity="status.progress >= 1 ? 0 : 1" :stroke="2" :progress="status.progress" :loading="status.progress === 0" />
                <span v-else-if="status.icon" :class="'icon small ' + status.icon" />
            </p>
            <h1>{{ title }}</h1>

            <template v-if="email.emailErrors && email.status === EmailStatus.Failed">
                <div v-for="(error, index) in email.emailErrors.errors" :key="index" class="error-box">
                    {{ error.getHuman() }}
                </div>
            </template>

            <template v-if="email.recipientsErrors && email.recipientsStatus === EmailRecipientsStatus.NotCreated">
                <div v-for="(error, index) in email.recipientsErrors.errors" :key="index" class="error-box">
                    {{ error.getHuman() }}
                </div>
            </template>

            <STList>
                <STListItem v-if="email.sentAt">
                    <template #left>
                        <span class="icon clock" />
                    </template>

                    <h2 class="style-title-list">
                        {{ $t('39a982c1-916a-43da-857d-a15f67c96c62') }}: {{ formatDateTime(email.sentAt) }}
                    </h2>
                </STListItem>
                <STListItem v-else>
                    <template #left>
                        <span class="icon clock" />
                    </template>

                    <h2 class="style-title-list">
                        {{ $t('52961dd4-be19-47a1-abe6-1e3c34e8157c') }}: {{ formatDateTime(email.createdAt) }}
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

                <STListItem v-if="email.emailRecipientsCount" :selectable="true" class="right-stack">
                    <template #left>
                        <span class="icon email-filled" />
                    </template>

                    <h2 class="style-title-list">
                        {{ $t('E-mail ontvangers') }}
                    </h2>

                    <p v-if="email.failedCount + email.softFailedCount > 1" class="style-description-small">
                        {{ $t('{count} emails konden niet worden verzonden', {
                            count: email.failedCount + email.softFailedCount
                        }) }}
                    </p>
                    <p v-else-if="email.failedCount + email.softFailedCount === 1" class="style-description-small">
                        {{ $t('Eén email kon niet worden verzonden') }}
                    </p>
                    <p v-else-if="email.succeededCount && email.emailRecipientsCount !== email.succeededCount" class="style-description-small">
                        {{ $t('Waarvan reeds {count} verzonden', { count: email.succeededCount }) }}
                    </p>

                    <template #right>
                        <p v-if="email.succeededCount && email.succeededCount !== email.emailRecipientsCount" class="style-description-small">
                            {{ formatInteger(email.succeededCount) }} / {{ formatInteger(email.emailRecipientsCount) }}
                        </p>
                        <p v-else class="style-description-small">
                            {{ formatInteger(email.emailRecipientsCount) }}
                        </p>
                        <span class="icon small arrow-right-small" />
                    </template>
                </STListItem>

                <STListItem v-if="email.membersCount" :selectable="true" class="right-stack" @click="openRelatedMembers">
                    <template #left>
                        <span class="icon membership-filled" />
                    </template>

                    <h2 class="style-title-list">
                        {{ $t('Leden') }}
                    </h2>
                    <p class="style-description-small">
                        {{ $t('Deze leden kunnen het bericht ook nalezen in het ledenportaal.') }}
                    </p>

                    <template #right>
                        <p class="style-description-small">
                            {{ formatInteger(email.membersCount) }}
                        </p>
                        <span class="icon small arrow-right-small" />
                    </template>
                </STListItem>
            </STList>

            <div v-if="replacedHtml" class="email-preview-box">
                <SafeHtmlBox :html="replacedHtml" />

                <hr v-if="email.attachments.length > 0" class="email-attachments-spacer">
                <STList v-if="email.attachments.length > 0" class="attachments-container">
                    <STListItem v-for="attachment in email.attachments" :key="attachment.id" class="file-list-item" :selectable="attachment.file" target="_blank" :href="attachment.file?.getPublicPath()" :download="attachment.file ? 1 : 0" :element-name="attachment.file ? 'a' : 'div'">
                        <template #left>
                            <span :class="'icon '+attachment.icon" />
                        </template>
                        <h3 class="style-title-list" v-text="attachment.filename" />
                        <p class="style-description-small">
                            {{ Formatter.fileSize(attachment.bytes) }}
                        </p>

                        <template #right>
                            <span class="button icon download" type="button" />
                        </template>
                    </STListItem>
                </STList>
            </div>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { ProgressRing, SafeHtmlBox, useInterval } from '@stamhoofd/components';
import { EmailPreview, EmailRecipientsStatus, EmailStatus, replaceEmailHtml } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useEmailStatus } from './hooks/useEmailStatus';
import { useUpdateEmail } from './hooks/useUpdateEmail';
import { Formatter } from '@stamhoofd/utility';
import { ComponentWithProperties, useShow } from '@simonbackx/vue-app-navigation';
import MembersTableView from '../members/MembersTableView.vue';

const props = defineProps<{
    email: EmailPreview;
}>();

const title = computed(() => {
    return props.email.replacedSubject || $t('0f763bbf-f9fd-4213-a675-42396d1065e8');
});
const getEmailStatus = useEmailStatus();
const status = computed(() => {
    return getEmailStatus(props.email);
});
const show = useShow();

const replacedHtml = computed(() => {
    if (!props.email.html) {
        return props.email.html;
    }
    return replaceEmailHtml(props.email.html, props.email.exampleRecipient?.replacements || []);
});

async function openRelatedMembers() {
    await show({
        components: [
            new ComponentWithProperties(MembersTableView, {
                customFilter: {
                    emails: {
                        $elemMatch: {
                            id: props.email.id,
                        },
                    },
                },
                customTitle: $t('Leden die dit bericht kregen'),
                customEstimatedRows: props.email.membersCount || 0,
            }),
        ],
    });
}

const { updateEmail } = useUpdateEmail(props.email);
useInterval(async ({ stop }) => {
    if (props.email.status !== EmailStatus.Sending && props.email.status !== EmailStatus.Queued) {
        stop();
        return;
    }
    await updateEmail();
}, 5_000);

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

    .email-attachments-spacer {
        @extend .style-hr;
        margin: 40px -30px 20px -30px;
    }

    @media (max-width: 600px) {
        padding: 40px 15px;

        .email-attachments-spacer {
            margin: 40px -15px 20px -15px;
        }
    }
}

</style>
