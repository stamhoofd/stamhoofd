<template>
    <div class="st-view">
        <STNavigationBar :title="title">
            <template v-if="email.deletedAt === null && email.status !== EmailStatus.Sending && email.status !== EmailStatus.Queued" #right>
                <LoadingButton v-if="email.status === EmailStatus.Failed" :loading="isRetryingEmail">
                    <button v-tooltip="$t('Opnieuw proberen')" type="button" class="button icon retry" @click="retrySending" />
                </LoadingButton>
                <button v-if="email.status === EmailStatus.Draft" v-tooltip="$t('Inhoud aanpassen en versturen')" type="button" class="button icon send" @click="editEmail" />
                <button v-else v-tooltip="$t('Inhoud aanpassen')" type="button" class="button icon edit" @click="editEmail" />
                <LoadingButton :loading="isDeletingEmail">
                    <button v-tooltip="$t('Verwijderen')" type="button" class="button icon trash" @click="doDelete" />
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

            <p v-if="email.failedCount > 0" class="error-box selectable" type="button" @click="navigate(Routes.Failed)">
                <span v-if="email.failedCount === 1">
                    {{ $t('Eén email kon niet worden verzonden') }}
                </span>
                <span v-else>{{ $t('{count} emails konden niet worden verzonden', {
                    count: email.failedCount
                }) }}</span>
                <span class="button text">
                    {{ $t('Bekijken') }}
                </span>
            </p>

            <p v-if="email.softFailedCount > 0" class="warning-box selectable" type="button" @click="navigate(Routes.Failed)">
                <span v-if="email.softFailedCount === 1">
                    {{ $t('Eén email werd overgeslagen') }}
                </span>
                <span v-else>{{ $t('{count} emails werden overgeslagen', {
                    count: email.softFailedCount
                }) }}</span>
                <span class="button text">
                    {{ $t('Bekijken') }}
                </span>
            </p>

            <STList>
                <STListItem v-if="!(email.sentAt && email.status === EmailStatus.Sent)" class="left-center">
                    <template #left>
                        <span class="icon calendar-grid small" />
                    </template>

                    <h2 class="style-title-list">
                        {{ $t('52961dd4-be19-47a1-abe6-1e3c34e8157c') }}: {{ formatDateTime(email.createdAt) }}
                    </h2>
                </STListItem>

                <STListItem v-if="email.fromName || email.organization?.name || email.fromAddress" v-tooltip="$t('Afzender van het bericht')">
                    <template #left>
                        <span class="icon email small" />
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
                        <span class="icon user small" />
                    </template>

                    <h2 v-if="email.user.name" class="style-title-list">
                        <span>{{ $t('Gepubliceerd door') }}: {{ email.user.name }} ({{ email.user.email }})</span><span v-tooltip="$t('Dit is enkel zichtbaar voor beheerders')" class="icon eye-off tiny" />
                    </h2>
                    <h2 v-else class="style-title-list">
                        <span>{{ $t('Gepubliceerd door') }}: {{ email.user.email }}</span><span v-tooltip="$t('Dit is enkel zichtbaar voor beheerders')" class="icon eye-off tiny" />
                    </h2>
                </STListItem>

                <STListItem v-if="email.status !== EmailStatus.Draft && !email.sendAsEmail && email.showInMemberPortal">
                    <template #left>
                        <span class="icon send-off small" />
                    </template>

                    <h2 class="style-title-list">
                        {{ $t('Niet verzonden als e-mail') }}
                    </h2>
                    <p class="style-description-small">
                        {{ $t('Dit bericht is enkel zichtbaar in het ledenportaal') }}
                    </p>
                </STListItem>

                <STListItem v-if="email.status !== EmailStatus.Draft && email.sendAsEmail && !email.showInMemberPortal && email.recipientFilter.canShowInMemberPortal">
                    <template #left>
                        <span class="icon eye-off small" />
                    </template>

                    <h2 class="style-title-list">
                        {{ $t('Niet zichtbaar in ledenportaal') }}
                    </h2>
                    <p class="style-description-small">
                        {{ $t('Dit bericht is enkel verzonden als e-mail') }}
                    </p>
                </STListItem>

                <STListItem v-if="email.sendAsEmail && email.emailRecipientsCount" :selectable="email.status !== EmailStatus.Draft" class="left-center  right-stack" @click="email.status !== EmailStatus.Draft ? navigate(Routes.Recipients) : undefined">
                    <template #left>
                        <span class="icon search" />
                    </template>

                    <h2 class="style-title-list">
                        {{ $t('E-mail ontvangers') }}
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
                        {{ $t('Leden') }}
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

            <template v-if="email.deletedAt === null && email.status !== EmailStatus.Sending && email.status !== EmailStatus.Queued">
                <hr>
                <h2>{{ $t('Acties') }}</h2>

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
                            {{ $t('Opnieuw proberen') }}
                        </h3>
                        <p class="style-description-small">
                            {{ $t('Probeer het bericht opnieuw te versturen') }}
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
                            {{ $t('Wijzig inhoud') }}
                        </h3>
                        <h3 v-else class="style-title-list">
                            {{ $t('Wijzig inhoud en versturen') }}
                        </h3>
                        <p v-if="email.status !== EmailStatus.Draft" class="style-description-small">
                            {{ $t('Je kan de inhoud van een bericht wijzigen, maar dit heeft enkel invloed op het zichtbare bericht in het ledenportaal.') }}
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
                            {{ $t('Wijzig zichtbaarheid') }}
                        </h3>
                        <p class="style-description-small">
                            {{ $t('Stel in of het bericht zichtbaar is in het ledenportaal of niet.') }}
                        </p>

                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" element-name="button" @click="doDelete">
                        <template #left>
                            <IconContainer icon="email" class="error">
                                <template #aside>
                                    <span class="icon trash small stroke" />
                                </template>
                            </IconContainer>
                        </template>
                        <h3 class="style-title-list">
                            {{ $t('Verwijderen') }}
                        </h3>
                        <p class="style-description-small">
                            {{ $t('Dit bericht zal niet langer zichtbaar zijn en heeft uiteraard geen effect op reeds verzonden e-mails. Je kan dit niet ongedaan maken.') }}
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
import { CenteredMessage, EmailView, IconContainer, ProgressRing, Spinner, Toast, useInterval, useOrganization, useUser } from '@stamhoofd/components';
import { EmailPreview, EmailRecipientsStatus, EmailStatus } from '@stamhoofd/structures';
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
                customTitle: $t('Leden'),
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
        $t('Deze e-mail opnieuw proberen te versturen?'),
        $t('Ja, opnieuw proberen'),
        $t('Een e-mail wordt nooit meerdere keren naar dezelfde persoon verstuurd'),
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
        $t('Dit bericht verwijderen?'),
        $t('Ja, verwijderen'),
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
