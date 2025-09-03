<template>
    <STListItem v-color="!organization ? (email.organization?.meta.color) : null" class="right-stack" :selectable="true">
        <template v-if="!organization && email.organization" #left>
            <OrganizationAvatar :organization="email.organization" />
        </template>
        <template v-else-if="!organization && !email.organizationId" #left>
            <PlatformAvatar />
        </template>

        <p v-if="status" :class="'style-title-prefix-list flex ' + (status.theme ?? '')">
            <span>{{ status.text }}</span>
            <ProgressRing v-if="status.progress !== undefined" :radius="7" :opacity="status.progress >= 1 ? 0 : 1" :stroke="2" :progress="status.progress" :loading="status.progress === 0" />
            <span v-else-if="status.icon" :class="'icon tiny ' + status.icon" />
        </p>
        <h3 class="style-title-list large">
            <span>{{ email.replacedSubject || $t('0f763bbf-f9fd-4213-a675-42396d1065e8') }}</span>
            <span v-if="email.status !== EmailStatus.Draft && !email.sendAsEmail" v-tooltip="$t('Niet verzonden als e-mail')" class="icon small send-off" />
            <span v-if="email.status !== EmailStatus.Draft && !email.showInMemberPortal" v-tooltip="$t('Niet zichtbaar in ledenportaal')" class="icon small earth-off" />
        </h3>
        <p v-if="email.snippet" class="style-description-small pre-wrap style-limit-lines" v-text="email.snippet" />

        <p v-if="email.fromName" v-tooltip="email.fromAddress" class="style-interactive-small">
            {{ email.fromName }} <template v-if="!organization && email.organization">
                ({{ email.organization.name }})
            </template>
        </p>
        <p v-else-if="email.fromAddress" class="style-interactive-small">
            {{ email.fromAddress }} <template v-if="!organization && email.organization">
                ({{ email.organization.name }})
            </template>
        </p>

        <template v-if="email.emailRecipientsCount" #right>
            <span v-if="email.spamComplaintsCount + email.hardBouncesCount + email.softBouncesCount + email.softFailedCount + email.failedCount > 0" class="style-description-small"><span>{{ formatInteger(email.spamComplaintsCount + email.hardBouncesCount + email.softBouncesCount + email.softFailedCount + email.failedCount) }}</span><span class="icon warning tiny" /></span>
            <span v-if="email.attachments.length" class="style-description-small"><span>{{ formatInteger(email.attachments.length) }}</span><span class="icon attachment tiny" /></span>
            <span class="style-description-small"><span>{{ formatInteger(email.emailRecipientsCount) }}</span><span class="icon email tiny" /></span>
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script setup lang="ts">
import { ProgressRing, useInterval, useOrganization } from '@stamhoofd/components';
import { EmailPreview, EmailStatus } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useEmailStatus } from '../hooks/useEmailStatus';
import { useUpdateEmail } from '../hooks/useUpdateEmail';
import OrganizationAvatar from '../../context/OrganizationAvatar.vue';
import PlatformAvatar from '../../context/PlatformAvatar.vue';

const props = defineProps<{
    email: EmailPreview;
}>();

const getEmailStatus = useEmailStatus();
const organization = useOrganization();
const status = computed(() => {
    return getEmailStatus(props.email);
});

const { updateEmail } = useUpdateEmail(props.email);
useInterval(async ({ stop }) => {
    if (props.email.status !== EmailStatus.Sending && props.email.status !== EmailStatus.Queued) {
        stop();
        return;
    }
    console.log('Updating email', props.email.id);
    await updateEmail();
}, 5_000);

</script>
