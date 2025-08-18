<template>
    <div class="st-view">
        <STNavigationBar :title="title" />

        <main class="center">
            <p v-if="status" :class="'style-title-prefix ' + (status.theme ?? '')">
                <span>{{ status.text }}</span><span v-if="status.icon" :class="'icon small ' + status.icon" />
            </p>
            <h1>{{ title }}</h1>

            <STList>
                <STListItem v-if="props.email.sentAt">
                    <template #left>
                        <span class="icon clock" />
                    </template>

                    <h2 class="style-title-list">
                        Verzonden op {{ formatDateTime(props.email.sentAt) }}
                    </h2>
                </STListItem>
                <STListItem v-else>
                    <template #left>
                        <span class="icon clock" />
                    </template>

                    <h2 class="style-title-list">
                        Aangemaakt op {{ formatDateTime(props.email.createdAt) }}
                    </h2>
                </STListItem>

                <STListItem v-if="props.email.fromName || props.email.fromAddress">
                    <template #left>
                        <span class="icon user" />
                    </template>

                    <h2 class="style-title-list">
                        Van: {{ props.email.fromName || props.email.fromAddress }}
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
                        Ontvangers
                    </h2>

                    <template #right>
                        <span>
                            {{ formatInteger(props.email.recipientCount) }}
                        </span>
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
import { EmailPreview, replaceEmailHtml } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useEmailStatus } from './hooks/useEmailStatus';

const props = defineProps<{
    email: EmailPreview;
}>();

const title = computed(() => {
    return props.email.subject || $t('Bericht zonder onderwerp');
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
