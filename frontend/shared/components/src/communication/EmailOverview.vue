<template>
    <div class="st-view">
        <STNavigationBar :title="title">
            <template v-if="auth.canAccessEmail(email, PermissionLevel.Write) && email.deletedAt === null && email.status !== EmailStatus.Sending && email.status !== EmailStatus.Queued" #right>
                <LoadingButton v-if="email.status === EmailStatus.Failed" :loading="isRetryingEmail">
                    <button v-tooltip="$t('%1EU')" type="button" class="button icon retry" @click="retrySending" />
                </LoadingButton>
                <button v-if="email.status === EmailStatus.Draft" v-tooltip="$t('%1EV')" type="button" class="button icon send" @click="editEmail" />
                <button v-else v-tooltip="$t('%1EW')" type="button" class="button icon edit" @click="editEmail" />
                <LoadingButton v-if="email.status === EmailStatus.Draft && auth.canAccessEmail(email, PermissionLevel.Full)" :loading="isDeletingEmail">
                    <button v-tooltip="$t('%CJ')" type="button" class="button icon trash" @click="doDelete" />
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
                <span>{{ email.spamComplaintsCount > 1 ? $t('%1EX', {count: email.spamComplaintsCount}) : $t('Eén ontvanger heeft de email als spam gemarkeerd') }}</span>
                <span class="button text">
                    {{ $t('%1EY') }}
                </span>
            </button>

            <button v-if="email.hardBouncesCount" class="error-box selectable" type="button" @click="navigate(Routes.HardBounces)">
                <span>{{ email.hardBouncesCount > 1 ? $t('%1EZ', {count: email.hardBouncesCount}) : $t('Eén ontvanger kon de email niet ontvangen (hard bounce)') }}</span>
                <span class="button text">
                    {{ $t('%1EY') }}
                </span>
            </button>

            <button v-if="email.softBouncesCount" class="warning-box selectable" type="button" @click="navigate(Routes.SoftBounces)">
                <span>{{ email.softBouncesCount > 1 ? $t('%1Ea', {count: email.softBouncesCount}) : $t('Eén ontvanger kon de email niet ontvangen (soft bounce)') }}</span>
                <span class="button text">
                    {{ $t('%1EY') }}
                </span>
            </button>

            <p v-if="email.failedCount > 0" class="error-box selectable" type="button" @click="navigate(Routes.Failed)">
                <span v-if="email.failedCount === 1">
                    {{ $t('%1Eb') }}
                </span>
                <span v-else>{{ $t('%1Ew', {
                    count: email.failedCount
                }) }}</span>
                <span class="button text">
                    {{ $t('%1EY') }}
                </span>
            </p>

            <p v-if="email.softFailedCount > 0" class="warning-box selectable" type="button" @click="navigate(Routes.Failed)">
                <span v-if="email.softFailedCount === 1">
                    {{ $t('%1Ec') }}
                </span>
                <span v-else>{{ $t('%1Ex', {
                    count: email.softFailedCount
                }) }}</span>
                <span class="button text">
                    {{ $t('%1EY') }}
                </span>
            </p>

            <STList>
                <STListItem v-if="!(email.sentAt && email.status === EmailStatus.Sent)" class="left-center">
                    <template #left>
                        <span class="icon date-time" />
                    </template>

                    <h2 class="style-title-list">
                        {{ $t('%1JJ') }}: {{ formatDateTime(email.createdAt) }}
                    </h2>
                </STListItem>

                <STListItem v-if="email.fromName || email.organization?.name || email.fromAddress" v-tooltip="$t('%1Ed')">
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
                        <span>{{ $t('%1Ee') }}: {{ email.user.name }} ({{ email.user.email }})</span><span v-tooltip="$t('%1Ef')" class="icon eye-off tiny" />
                    </h2>
                    <h2 v-else class="style-title-list">
                        <span>{{ $t('%1Ee') }}: {{ email.user.email }}</span><span v-tooltip="$t('%1Ef')" class="icon eye-off tiny" />
                    </h2>
                </STListItem>

                <STListItem v-if="email.status !== EmailStatus.Draft && !email.sendAsEmail && email.showInMemberPortal">
                    <template #left>
                        <span class="icon send-off" />
                    </template>

                    <h2 class="style-title-list">
                        {{ $t('%1Eg') }}
                    </h2>
                    <p class="style-description-small">
                        {{ $t('%1Eh') }}
                    </p>
                </STListItem>

                <STListItem v-if="email.status !== EmailStatus.Draft && email.sendAsEmail && !email.showInMemberPortal && email.recipientFilter.canShowInMemberPortal">
                    <template #left>
                        <span class="icon eye-off" />
                    </template>

                    <h2 class="style-title-list">
                        {{ $t('%1Ei') }}
                    </h2>
                    <p class="style-description-small">
                        {{ $t('%1Ej') }}
                    </p>
                </STListItem>

                <STListItem v-if="email.sendAsEmail && email.emailRecipientsCount" :selectable="email.status !== EmailStatus.Draft" class="left-center  right-stack" @click="email.status !== EmailStatus.Draft ? navigate(Routes.Recipients) : undefined">
                    <template #left>
                        <span class="icon search" />
                    </template>

                    <h2 class="style-title-list">
                        {{ $t('%1Ek') }}
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
                        {{ $t('%1EH') }}
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
                <h2>{{ $t('%16X') }}</h2>

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
                            {{ $t('%1EU') }}
                        </h3>
                        <p class="style-description-small">
                            {{ $t('%1El') }}
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
                            {{ $t('%1Em') }}
                        </h3>
                        <h3 v-else class="style-title-list">
                            {{ $t('%1En') }}
                        </h3>
                        <p v-if="email.status !== EmailStatus.Draft" class="style-description-small">
                            {{ $t('%1Eo') }}
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
                            {{ $t('%1Ep') }}
                        </h3>
                        <p class="style-description-small">
                            {{ $t('%1Eq') }}
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
                            {{ $t('%CJ') }}
                        </h3>
                        <p class="style-description-small">
                            {{ $t('%1Er') }}
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
import { CenteredMessage } from '#overlays/CenteredMessage.ts';
import EmailView from '#email/EmailView.vue';
import IconContainer from '#icons/IconContainer.vue';
import ProgressRing from '#icons/ProgressRing.vue';
import Spinner from '#Spinner.vue';
import { Toast } from '#overlays/Toast.ts';
import { useAuth } from '#hooks/useAuth.ts';
import { useInterval } from '#hooks/useInterval.ts';
import { useOrganization } from '#hooks/useOrganization.ts';
import { useUser } from '#hooks/useUser.ts';
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
    return props.email.replacedSubject || $t('%1D1');
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
                customTitle: $t('%1EH'),
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
        $t('%1Es'),
        $t('%1Et'),
        $t('%1Eu'),
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
        $t('%1Ev'),
        $t('%55'),
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
