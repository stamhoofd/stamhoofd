<template>
    <div v-if="replacedHtml" class="email-preview-box" :class="{'web-version': webVersion}">
        <SafeHtmlBox :html="replacedHtml" :allow-clicks="allowClicks" :custom-css="webVersion ? '.email-only { display: none; }' : ''" />

        <hr v-if="email.attachments.length > 0" class="email-attachments-spacer">
        <STList v-if="email.attachments.length > 0" class="attachments-container">
            <STListItem v-for="attachment in email.attachments" :key="attachment.id" class="file-list-item" :selectable="!!attachment.file" target="_blank" :href="attachment.file?.getPublicPath()" :download="attachment.file ? 1 : 0" :element-name="attachment.file ? 'a' : 'div'">
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
</template>

<script lang="ts" setup>
import { SafeHtmlBox } from '@stamhoofd/components';
import { EmailPreview, EmailRecipient, EmailWithRecipients, replaceEmailHtml } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';

const props = withDefaults(defineProps<{
    email: EmailPreview | EmailWithRecipients;
    recipient?: EmailRecipient | null;
    allowClicks?: boolean;
    webVersion?: boolean;
}>(), {
    recipient: null,
    allowClicks: false,
    webVersion: false,
});

const replacedHtml = computed(() => {
    if (!props.email.html) {
        return props.email.html;
    }
    return replaceEmailHtml(props.email.html, props.recipient?.replacements ?? props.email.exampleRecipient?.replacements ?? []);
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

    &.web-version {
        padding: 0;
        margin: 0;
        background-color: transparent
    }

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
