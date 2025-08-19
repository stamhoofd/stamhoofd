<template>
    <STListItem class="right-stack smartphone-wrap-left" :selectable="true">
        <p v-if="status" :class="'style-title-prefix-list ' + (status.theme ?? '')">
            <span>{{ status.text }}</span><span v-if="status.icon" :class="'icon tiny ' + status.icon" />
        </p>
        <h3 class="style-title-list large">
            {{ email.subject || $t('0f763bbf-f9fd-4213-a675-42396d1065e8') }}
        </h3>

        <p v-if="email.fromName" v-tooltip="email.fromAddress" class="style-description-small">
            Van {{ email.fromName }}
        </p>
        <p v-else-if="email.fromAddress" class="style-description-small">
            Vanaf {{ email.fromAddress }}
        </p>

        <template v-if="email.recipientCount" #right>
            <span class="style-description-small"><span>{{ formatInteger(email.recipientCount) }}</span><span class="icon email tiny" /></span>
        </template>
    </STListItem>
</template>

<script setup lang="ts">
import { EmailPreview } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useEmailStatus } from '../hooks/useEmailStatus';

const props = defineProps<{
    email: EmailPreview;
}>();

const getEmailStatus = useEmailStatus();
const status = computed(() => {
    return getEmailStatus(props.email);
});

</script>
