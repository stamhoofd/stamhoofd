<template>
    <div class="st-view">
        <STNavigationBar :title="title">
            <template v-if="auth.canAccessEmail(email, PermissionLevel.Write) && email.deletedAt === null && email.status !== EmailStatus.Sending && email.status !== EmailStatus.Queued" #right>
                <LoadingButton v-if="email.status === EmailStatus.Failed" :loading="isRetryingEmail">
                    <button v-tooltip="$t('314810ef-ff16-4b22-b8a5-399d5d820a4a')" type="button" class="button icon retry" @click="retrySending" />
                </LoadingButton>
                <button v-if="email.status === EmailStatus.Draft" v-tooltip="$t('2b799708-dc8a-4ab5-ad15-11c89bfa23da')" type="button" class="button icon send" @click="editEmail" />
                <button v-else v-tooltip="$t('a7c3d104-58c1-41ac-8a33-febe6f474215')" type="button" class="button icon edit" @click="editEmail" />
                <LoadingButton v-if="email.status === EmailStatus.Draft && auth.canAccessEmail(email, PermissionLevel.Full)" :loading="isDeletingEmail">
                    <button v-tooltip="$t('d67c7c61-5387-48a5-b63b-a78682a54fd8')" type="button" class="button icon trash" @click="doDelete" />
                </LoadingButton>
            </template>
        </STNavigationBar>

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

            <template v-if="email.status !== EmailStatus.Queued && email.status !== EmailStatus.Sending && email.recipientsErrors && email.recipientsStatus === EmailRecipientsStatus.NotCreated">
                <div v-for="(error, index) in email.recipientsErrors.errors" :key="index" class="error-box">
                    {{ error.getHuman() }}
                </div>
            </template>

            <button v-if="email.spamComplaintsCount" class="error-box selectable" type="button" @click="navigate(Routes.Complaints)">
                <span>{{ email.spamComplaintsCount > 1 ? $t('1b19e64e-c1ab-4755-bef6-a9f3f5b551d6', {count: email.spamComplaintsCount}) : $t('Eén ontvanger heeft de email als spam gemarkeerd') }}</span>
                <span class="button text">
                    {{ $t('0415018c-c90d-489a-901f-a4729b8c1d24') }}
                </span>
            </button>

            <button v-if="email.hardBouncesCount" class="error-box selectable" type="button" @click="navigate(Routes.HardBounces)">
                <span>{{ email.hardBouncesCount > 1 ? $t('0cd6f68d-48b9-46af-a290-bee4aa0c853c', {count: email.hardBouncesCount}) : $t('Eén ontvanger kon de email niet ontvangen (hard bounce)') }}</span>
                <span class="button text">
                    {{ $t('0415018c-c90d-489a-901f-a4729b8c1d24') }}
                </span>
            </button>

            <button v-if="email.softBouncesCount" class="warning-box selectable" type="button" @click="navigate(Routes.SoftBounces)">
                <span>{{ email.softBouncesCount > 1 ? $t('2bcd25b3-fda7-41e2-bf92-e7c1bd2780f2', {count: email.softBouncesCount}) : $t('Eén ontvanger kon de email niet ontvangen (soft bounce)') }}</span>
                <span class="button text">
                    {{ $t('0415018c-c90d-489a-901f-a4729b8c1d24') }}
                </span>
            </button>

            <p v-if="email.failedCount > 0" class="error-box selectable" type="button" @click="navigate(Routes.Failed)">
                <span v-if="email.failedCount === 1">
                    {{ $t('49e5596f-9e08-4766-b159-2678580a00c3') }}
                </span>
                <span v-else>{{ $t('faed0d06-516e-4a4e-8737-6f33f59c4af4', {
                    count: email.failedCount
                }) }}</span>
                <span class="button text">
                    {{ $t('0415018c-c90d-489a-901f-a4729b8c1d24') }}
                </span>
            </p>

            <p v-if="email.softFailedCount > 0" class="warning-box selectable" type="button" @click="navigate(Routes.Failed)">
                <span v-if="email.softFailedCount === 1">
                    {{ $t('de176a16-fcf1-499c-aa77-0323d18a687d') }}
                </span>
                <span v-else>{{ $t('47503212-d717-45d2-b067-da0813374113', {
                    count: email.softFailedCount
                }) }}</span>
                <span class="button text">
                    {{ $t('0415018c-c90d-489a-901f-a4729b8c1d24') }}
                </span>
            </p>

            <STList>
                <STListItem v-if="!(email.sentAt && email.status === EmailStatus.Sent)" class="left-center">
                    <template #left>
                        <span class="icon date-time" />
                    </template>

                    <h2 class="style-title-list">
                        {{ $t('52961dd4-be19-47a1-abe6-1e3c34e8157c') }}: {{ formatDateTime(email.createdAt) }}
                    </h2>
                </STListItem>

                <STListItem v-if="email.fromName || email.organization?.name || email.fromAddress" v-tooltip="$t('26e90995-ce5d-48ff-96e8-21e39e489d14')">
                    <template #left>
                        <span class="icon email" />
                    </template>

                    <h2 class="style-title-list">
                        {{ !organization && email.organization && email.fromName && (email.organization.name !== email.fromName) ? `${email.organization.name} (${email.fromName || email.organization?.name || email.fromAddress })` : email.fromName || email.organization?.name || email.fromAddress }}
                    </h2>
                    <p v-if="email.fromName || email.organization" class="style-description-small">
                        {{ email.fromAddress }}
                    </p>
                </STListItem>

                <STListItem v-if="email.user && (!user || email.user.id !== user.id)">
                    <template #left>
                        <span class="icon user" />
                    </template>

                    <h2 v-if="email.user.name" class="style-title-list">
                        <span>{{ $t('9e736403-a321-4462-8c8d-c7234fa1633c') }}: {{ email.user.name }} ({{ email.user.email }})</span><span v-tooltip="$t('089accda-4b1f-4767-8e46-d7f71c24068a')" class="icon eye-off tiny" />
                    </h2>
                    <h2 v-else class="style-title-list">
                        <span>{{ $t('9e736403-a321-4462-8c8d-c7234fa1633c') }}: {{ email.user.email }}</span><span v-tooltip="$t('089accda-4b1f-4767-8e46-d7f71c24068a')" class="icon eye-off tiny" />
                    </h2>
                </STListItem>

                <STListItem v-if="email.status !== EmailStatus.Draft && !email.sendAsEmail && email.showInMemberPortal">
                    <template #left>
                        <span class="icon send-off" />
                    </template>

                    <h2 class="style-title-list">
                        {{ $t('a7685897-9158-4a82-bee1-9b74187ec599') }}
                    </h2>
                    <p class="style-description-small">
                        {{ $t('0cc07b8f-9eaf-413a-9c2d-17363611f2d4') }}
                    </p>
                </STListItem>

                <STListItem v-if="email.status !== EmailStatus.Draft && email.sendAsEmail && !email.showInMemberPortal && email.recipientFilter.canShowInMemberPortal">
                    <template #left>
                        <span class="icon eye-off" />
                    </template>

                    <h2 class="style-title-list">
                        {{ $t('e32d4a22-592a-4917-b115-35ee6ca50290') }}
                    </h2>
                    <p class="style-description-small">
                        {{ $t('c07ff2d7-46c5-429d-bcff-c77c16017611') }}
                    </p>
                </STListItem>

                <STListItem v-if="email.sendAsEmail && email.emailRecipientsCount" :selectable="email.status !== EmailStatus.Draft" class="left-center  right-stack" @click="email.status !== EmailStatus.Draft ? navigate(Routes.Recipients) : undefined">
                    <template #left>
                        <span class="icon search" />
                    </template>

                    <h2 class="style-title-list">
                        {{ $t('221a0568-b308-4803-bd53-cb633f726f10') }}
                    </h2>

                    <template #right>
                        <p class="style-description-small">
                            {{ formatInteger(email.emailRecipientsCount) }}
                        </p>
                        <span v-if="email.status !== EmailStatus.Draft" class="icon small arrow-right-small" />
                    </template>
                </STListItem>

                <STListItem v-if="email.membersCount && email.status !== EmailStatus.Draft" :selectable="true" class="left-center right-stack" @click="navigate(Routes.Members)">
                    <template #left>
                        <span class="icon search" />
                    </template>

                    <h2 class="style-title-list">
                        {{ $t('19da8d23-acea-43c2-bfdd-742447ca57f1') }}
                    </h2>

                    <template #right>
                        <p class="style-description-small">
                            {{ formatInteger(email.membersCount) }}
                        </p>
                        <span class="icon small arrow-right-small" />
                    </template>
                </STListItem>
            </STList>

            <EmailPreviewBox :email="email" />

            <template v-if="email.deletedAt === null && email.status !== EmailStatus.Sending && email.status !== EmailStatus.Queued && auth.canAccessEmail(email, PermissionLevel.Write)">
                <hr>
                <h2>{{ $t('7c093146-6de1-413b-bbda-2ada3fd63dea') }}</h2>

                <STList>
                    <STListItem v-if="email.status === EmailStatus.Failed" :selectable="true" element-name="button" @click="retrySending">
                        <template #left>
                            <IconContainer icon="email" class="secundary">
                                <template #aside>
                                    <span class="icon retry small stroke" />
                                </template>
                            </IconContainer>
                        </template>
                        <h3 class="style-title-list">
                            {{ $t('314810ef-ff16-4b22-b8a5-399d5d820a4a') }}
                        </h3>
                        <p class="style-description-small">
                            {{ $t('02f663a0-3c65-495e-a485-71a942f06c3a') }}
                        </p>

                        <template #right>
                            <Spinner v-if="isRetryingEmail" />
                            <span v-else class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" element-name="button" @click="editEmail">
                        <template #left>
                            <IconContainer v-if="email.status !== EmailStatus.Draft" icon="email" class="primary">
                                <template #aside>
                                    <span class="icon edit stroke small" />
                                </template>
                            </IconContainer>
                            <IconContainer v-else icon="send" class="primary" />
                        </template>
                        <h3 v-if="email.status !== EmailStatus.Draft" class="style-title-list">
                            {{ $t('0089568d-e3cf-4dc7-b96a-2ec7fe233227') }}
                        </h3>
                        <h3 v-else class="style-title-list">
                            {{ $t('f547c5e3-f179-44b0-b15f-19a5813be244') }}
                        </h3>
                        <p v-if="email.status !== EmailStatus.Draft" class="style-description-small">
                            {{ $t('890739a4-277c-4757-b6e6-c9f535d138a3') }}
                        </p>

                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem v-if="email.status !== EmailStatus.Draft && email.recipientFilter.canShowInMemberPortal" :selectable="true" element-name="button" @click="editSendSettings">
                        <template #left>
                            <IconContainer icon="eye-off" class="primary" />
                        </template>
                        <h3 class="style-title-list">
                            {{ $t('31894c35-aca4-441e-bdfb-f45ed7e125d7') }}
                        </h3>
                        <p class="style-description-small">
                            {{ $t('8e074663-072b-4331-b6e9-e472969437a2') }}
                        </p>

                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem v-if="auth.canAccessEmail(email, PermissionLevel.Full)" :selectable="true" element-name="button" @click="doDelete">
                        <template #left>
                            <IconContainer icon="email" class="error">
                                <template #aside>
                                    <span class="icon trash small stroke" />
                                </template>
                            </IconContainer>
                        </template>
                        <h3 class="style-title-list">
                            {{ $t('d67c7c61-5387-48a5-b63b-a78682a54fd8') }}
                        </h3>
                        <p class="style-description-small">
                            {{ $t('cde18ff3-28ea-40ad-b385-37129f4091c4') }}
                        </p>

                        <template #right>
                            <Spinner v-if="isDeletingEmail" />
                            <span v-else class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
            </template>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, defineRoutes, NavigationController, useNavigate, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, EmailView, IconContainer, ProgressRing, Spinner, Toast, useAuth, useInterval, useOrganization, useUser } from '@stamhoofd/components';
import { EmailPreview, EmailRecipientsStatus, EmailStatus, PermissionLevel } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import MembersTableView from '../members/MembersTableView.vue';
import EmailPreviewBox from './components/EmailPreviewBox.vue';
import EmailRecipientsTableView from './EmailRecipientsTableView.vue';
import { useEmailStatus } from './hooks/useEmailStatus';
import { usePatchEmail } from './hooks/usePatchEmail';
import { useUpdateEmail } from './hooks/useUpdateEmail';
import EmailSendSettingsView from '../email/EmailSendSettingsView.vue';

const props = defineProps<{
    email: EmailPreview;
}>();

const title = computed(() => {
    return props.email.replacedSubject || $t('0f763bbf-f9fd-4213-a675-42396d1065e8');
});
const auth = useAuth();
const getEmailStatus = useEmailStatus();
const status = computed(() => {
    return getEmailStatus(props.email);
});
const navigate = useNavigate();
const { patchEmail } = usePatchEmail();
const present = usePresent();
const user = useUser();
const organization = useOrganization();

enum Routes {
    Members = 'leden',
    Recipients = 'ontvangers',
    Complaints = 'complaints',
    HardBounces = 'hard-bounces',
    SoftBounces = 'soft-bounces',
    Failed = 'mislukt',
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
                customTitle: $t('19da8d23-acea-43c2-bfdd-742447ca57f1'),
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
                filterType: 'complaints',
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
                filterType: 'hard-bounces',
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
                filterType: 'soft-bounces',
                filter: {
                    softBounceError: {
                        $neq: null,
                    },
                },
            };
        },
    },
    {
        url: Routes.Failed,
        component: EmailRecipientsTableView,
        paramsToProps: () => {
            return {
                email: props.email,
                filterType: 'failed',
                filter: {
                    failError: {
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
        if (props.email.status !== EmailStatus.Failed && props.email.status !== EmailStatus.Draft) {
            // don't stop, otherwise the resume button won't work
            stop();
        }
        return;
    }
    await updateEmail();
}, 5_000);

const isRetryingEmail = ref(false);
const isDeletingEmail = ref(false);
async function retrySending() {
    if (isRetryingEmail.value) {
        return;
    }
    if (!await CenteredMessage.confirm(
        $t('9e0c8c63-6022-4742-918e-2716247d4c2f'),
        $t('3dc84002-909a-45e2-a033-317be0a09c4e'),
        $t('c284a7c8-69bb-4ceb-bf01-5f952c453aa9'),
    )) {
        return;
    }

    isRetryingEmail.value = true;
    try {
        await patchEmail(props.email, EmailPreview.patch({
            id: props.email.id,
            status: EmailStatus.Queued,
        }));
    }
    catch (e) {
        // Handled by the hook
        Toast.fromError(e).show();
    }
    isRetryingEmail.value = false;
}

async function doDelete() {
    if (isDeletingEmail.value) {
        return;
    }
    if (!await CenteredMessage.confirm(
        $t('c3a06b52-d25c-4ec4-afe7-208773e1332e'),
        $t('eee720f3-5e00-429c-a847-cb3d4e237e4d'),
    )) {
        return;
    }

    isDeletingEmail.value = true;
    try {
        await patchEmail(props.email, EmailPreview.patch({
            id: props.email.id,
            deletedAt: new Date(),
        }));
    }
    catch (e) {
        // Handled by the hook
        Toast.fromError(e).show();
    }
    isDeletingEmail.value = false;
}

async function editEmail() {
    await present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(EmailView, {
                    recipientFilterOptions: [],
                    editEmail: props.email,
                }),
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

async function editSendSettings() {
    await present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(EmailSendSettingsView, {
                    editEmail: props.email,
                    willSend: false,
                }),
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

</script>
