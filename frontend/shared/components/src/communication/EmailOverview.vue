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

            <button v-if="email.spamComplaintsCount" class="error-box selectable" type="button" @click="navigate(Routes.Complaints)">
                <span>{{ email.spamComplaintsCount > 1 ? $t('{count} ontvangers hebben hun email als spam gemarkeerd', {count: email.spamComplaintsCount}) : $t('Eén ontvanger heeft de email als spam gemarkeerd') }}</span>
                <span class="button text">
                    {{ $t('Bekijken') }}
                </span>
            </button>

            <button v-if="email.hardBouncesCount" class="error-box selectable" type="button" @click="navigate(Routes.HardBounces)">
                <span>{{ email.hardBouncesCount > 1 ? $t('{count} ontvangers konden de email niet ontvangen (hard bounce)', {count: email.hardBouncesCount}) : $t('Eén ontvanger kon de email niet ontvangen (hard bounce)') }}</span>
                <span class="button text">
                    {{ $t('Bekijken') }}
                </span>
            </button>

            <button v-if="email.softBouncesCount" class="warning-box selectable" type="button" @click="navigate(Routes.SoftBounces)">
                <span>{{ email.softBouncesCount > 1 ? $t('{count} ontvangers konden de email niet ontvangen (soft bounce)', {count: email.softBouncesCount}) : $t('Eén ontvanger kon de email niet ontvangen (soft bounce)') }}</span>
                <span class="button text">
                    {{ $t('Bekijken') }}
                </span>
            </button>

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

                <STListItem v-if="email.emailRecipientsCount" :selectable="true" class="right-stack" @click="navigate(Routes.Recipients)">
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

                <STListItem v-if="email.membersCount" :selectable="true" class="right-stack" @click="navigate(Routes.Members)">
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

            <EmailPreviewBox :email="email" />
        </main>
    </div>
</template>

<script lang="ts" setup>
import { defineRoutes, useNavigate } from '@simonbackx/vue-app-navigation';
import { ProgressRing, useInterval } from '@stamhoofd/components';
import { EmailPreview, EmailRecipientsStatus, EmailStatus } from '@stamhoofd/structures';
import { computed } from 'vue';
import MembersTableView from '../members/MembersTableView.vue';
import EmailPreviewBox from './components/EmailPreviewBox.vue';
import EmailRecipientsTableView from './EmailRecipientsTableView.vue';
import { useEmailStatus } from './hooks/useEmailStatus';
import { useUpdateEmail } from './hooks/useUpdateEmail';

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
const navigate = useNavigate();

enum Routes {
    Members = 'leden',
    Recipients = 'ontvangers',
    Complaints = 'complaints',
    HardBounces = 'hard-bounces',
    SoftBounces = 'soft-bounces',
}

defineRoutes([
    {
        url: Routes.Members,
        component: MembersTableView,
        paramsToProps: () => {
            return {
                customFilter: {
                    emails: {
                        $elemMatch: {
                            id: props.email.id,
                        },
                    },
                },
                customTitle: $t('Leden die dit bericht zien'),
                customEstimatedRows: props.email.membersCount || 0,
            };
        },
    },
    {
        url: Routes.Recipients,
        component: EmailRecipientsTableView,
        paramsToProps: () => {
            return {
                email: props.email,
            };
        },
    },
    {
        url: Routes.Complaints,
        component: EmailRecipientsTableView,
        paramsToProps: () => {
            return {
                email: props.email,
                filter: {
                    spamComplaintError: {
                        $neq: null,
                    },
                },
            };
        },
    },
    {
        url: Routes.HardBounces,
        component: EmailRecipientsTableView,
        paramsToProps: () => {
            return {
                email: props.email,
                filter: {
                    hardBounceError: {
                        $neq: null,
                    },
                },
            };
        },
    },
    {
        url: Routes.SoftBounces,
        component: EmailRecipientsTableView,
        paramsToProps: () => {
            return {
                email: props.email,
                filter: {
                    softBounceError: {
                        $neq: null,
                    },
                },
            };
        },
    },
]);

const { updateEmail } = useUpdateEmail(props.email);
useInterval(async ({ stop }) => {
    if (props.email.status !== EmailStatus.Sending && props.email.status !== EmailStatus.Queued) {
        stop();
        return;
    }
    await updateEmail();
}, 5_000);

</script>
