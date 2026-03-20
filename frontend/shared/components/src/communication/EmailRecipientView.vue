<template>
    <LoadingViewTransition>
        <div v-if="!loadingDuplicates" class="st-view">
            <STNavigationBar :title="title">
                <template #right>
                    <button v-if="hasPrevious || hasNext" type="button" class="button icon arrow-up" :disabled="!hasPrevious" :v-tooltip="$t('%1Ey')" @click="goBack" />
                    <button v-if="hasNext || hasPrevious" type="button" class="button icon arrow-down" :disabled="!hasNext" :v-tooltip="$t('%1Ez')" @click="goForward" />
                </template>
            </STNavigationBar>

            <main>
                <h1>
                    {{ title }}
                </h1>

                <p v-if="recipient.previousFailError && !recipient.failError" class="info-box">
                    {{ $t('%1Ge') }}
                </p>

                <p v-if="recipient.sentAt && emailAddresSettings && (emailAddresSettings.unsubscribedAll || emailAddresSettings.unsubscribedMarketing)" class="info-box">
                    <I18nComponent :t="$t('%1Gf')" />
                </p>

                <p v-if="recipient.spamComplaintError" class="error-box">
                    <I18nComponent :t="$t('%1F0')">
                        <template #button="{content}">
                            <a class="inline-link" :href="$domains.getDocs('spam-complaints')" target="_blank">
                                {{ content }}
                            </a>
                        </template>
                    </I18nComponent>
                </p>

                <p v-if="recipient.hardBounceError" class="error-box">
                    <I18nComponent :t="$t('%1F1')">
                        <template #button="{content}">
                            <a class="inline-link" :href="$domains.getDocs('bounces')" target="_blank">
                                {{ content }}
                            </a>
                        </template>
                    </I18nComponent>
                </p>

                <p v-if="recipient.softBounceError" class="warning-box">
                    <I18nComponent :t="$t('%1F2')">
                        <template #button="{content}">
                            <a class="inline-link" :href="$domains.getDocs('bounces')" target="_blank">
                                {{ content }}
                            </a>
                        </template>
                    </I18nComponent>
                </p>

                <p v-if="deduplicatedOf.length > 0" class="info-box">
                    {{ $t('%1F3') }}
                </p>

                <STList class="info">
                    <STListItem v-if="recipient.name || recipient.email">
                        <h3 class="style-definition-label">
                            {{ $t('%1F4') }}
                        </h3>
                        <p v-copyable class="style-definition-text style-copyable">
                            <span>{{ capitalizeFirstLetter(recipient.name ?? '') || recipient.email }}</span>
                        </p>

                        <p v-if="recipient.name" v-copyable class="style-description-small style-copyable">
                            <span>{{ recipient.email }}</span>
                        </p>
                    </STListItem>

                    <STListItem v-for="(member, index) of members" :key="member.id" :selectable="true" @click="showMember(member.id)">
                        <h3 class="style-definition-label">
                            {{ $t('%16d') }} {{ members.length > 1 ? `(${index + 1})` : '' }}
                        </h3>
                        <p class="style-definition-text">
                            <span>{{ capitalizeFirstLetter(member.name) }}</span>
                        </p>

                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem v-if="recipient.sentAt">
                        <h3 class="style-definition-label">
                            {{ $t('%1F5') }}
                        </h3>
                        <p class="style-definition-text">
                            <span>{{ formatDateTime(recipient.sentAt) }}</span>
                        </p>
                    </STListItem>

                    <STListItem v-if="recipient.failError && isSoftEmailRecipientError(recipient.failError)" class="theme-warning">
                        <h3 class="style-definition-label">
                            <span style="color: var(--color-primary-dark);">{{ $t('%1F6') }}</span><span class="icon warning tiny" />
                        </h3>
                        <p class="style-definition-text">
                            {{ recipient.failError.getHuman() }}
                        </p>
                    </STListItem>

                    <STListItem v-else-if="recipient.failError" class="theme-error">
                        <h3 class="style-definition-label">
                            <span>{{ $t('%1F7') }}</span><span class="icon error tiny" />
                        </h3>
                        <p class="style-definition-text">
                            {{ recipient.failError.getHuman() }}
                        </p>
                    </STListItem>

                    <STListItem v-if="recipient.hardBounceError" class="theme-error">
                        <h3 class="style-definition-label">
                            <span>{{ $t('%1F8') }}</span><span class="icon error tiny" />
                        </h3>
                        <template v-if="bounceErrorToHuman(recipient.hardBounceError)">
                            <p class="style-definition-text pre-wrap" v-text="bounceErrorToHuman(recipient.hardBounceError)" />
                            <p class="style-description-small pre-wrap" v-text="recipient.hardBounceError" />
                        </template>
                        <p v-else class="style-definition-text pre-wrap" v-text="recipient.hardBounceError" />
                    </STListItem>

                    <STListItem v-if="recipient.softBounceError" class="theme-warning">
                        <h3 class="style-definition-label">
                            <span style="color: var(--color-primary-dark);">{{ $t('%1F9') }}</span><span class="icon warning yellow tiny" />
                        </h3>
                        <template v-if="bounceErrorToHuman(recipient.softBounceError)">
                            <p class="style-definition-text pre-wrap" v-text="bounceErrorToHuman(recipient.softBounceError)" />
                            <p class="style-description-small pre-wrap" v-text="recipient.softBounceError" />
                        </template>
                        <p v-else class="style-definition-text pre-wrap" v-text="recipient.softBounceError" />
                    </STListItem>
                </STList>

                <EmailPreviewBox v-if="email && recipient.sentAt" :email="email" :recipient="recipient" />

                <template v-if="email && email.status === EmailStatus.Sent && (!recipient.sentAt || (emailAddresSettings && (emailAddresSettings.markedAsSpam || emailAddresSettings.hardBounce))) && auth.hasPlatformFullAccess()">
                    <hr>
                    <h2>{{ $t('%16X') }}</h2>

                    <STList>
                        <STListItem v-if="emailAddresSettings && (emailAddresSettings.markedAsSpam || emailAddresSettings.hardBounce)" :selectable="true" element-name="button" @click="unblockEmailAddress">
                            <template #left>
                                <IconContainer icon="email" class="error">
                                    <template #aside>
                                        <span class="icon unlock small stroke" />
                                    </template>
                                </IconContainer>
                            </template>
                            <h3 class="style-title-list">
                                {{ $t('%1Gg') }}
                            </h3>
                            <p class="style-description-small">
                                {{ $t('%1Gh') }}
                            </p>

                            <template #right>
                                <Spinner v-if="isUnblockingEmailAddress" />
                                <span v-else class="icon arrow-right-small gray" />
                            </template>
                        </STListItem>

                        <STListItem v-if="emailAddresSettings && !(emailAddresSettings.markedAsSpam || emailAddresSettings.hardBounce)">
                            <template #left>
                                <IconContainer icon="email" class="theme-success">
                                    <template #aside>
                                        <span class="icon success small stroke" />
                                    </template>
                                </IconContainer>
                            </template>
                            <h3 class="style-title-list">
                                {{ $t('%1Gi') }}
                            </h3>
                            <p class="style-description-small">
                                {{ $t('%1Gj') }}
                            </p>
                        </STListItem>

                        <STListItem v-if="!recipient.sentAt && email && email.status === EmailStatus.Sent && (!emailAddresSettings || !(emailAddresSettings.markedAsSpam || emailAddresSettings.hardBounce))" :selectable="true" element-name="button" @click="retrySending">
                            <template #left>
                                <IconContainer icon="email" class="theme-secundary">
                                    <template #aside>
                                        <span class="icon retry small stroke" />
                                    </template>
                                </IconContainer>
                            </template>
                            <h3 class="style-title-list">
                                {{ $t('%1Gk') }}
                            </h3>
                            <p class="style-description-small">
                                {{ $t('%1Gl') }}
                            </p>

                            <template #right>
                                <Spinner v-if="isRetrying" />
                                <span v-else class="icon arrow-right-small gray" />
                            </template>
                        </STListItem>
                    </STList>
                </template>
            </main>
        </div>
    </LoadingViewTransition>
</template>

<script setup lang="ts">
import type { EmailPreview} from '@stamhoofd/structures';
import { bounceErrorToHuman, EmailAddressSettings, EmailRecipient, EmailStatus, isSoftEmailRecipientError, LimitedFilteredRequest } from '@stamhoofd/structures';
import { useAuth, useBackForward, useContext } from '../hooks';
import EmailPreviewBox from './components/EmailPreviewBox.vue';
import I18nComponent from '@stamhoofd/frontend-i18n/I18nComponent';
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { LoadingViewTransition, PromiseView } from '../containers';
import { MemberSegmentedView } from '../members';
import { Toast } from '../overlays/Toast';
import { useEmailRecipientsObjectFetcher, useMembersObjectFetcher } from '../fetchers';
import type { Ref} from 'vue';
import { computed, onMounted, ref } from 'vue';
import type { Decoder } from '@simonbackx/simple-encoding';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import IconContainer from '../icons/IconContainer.vue';
import { CenteredMessage } from '../overlays/CenteredMessage';

const props = withDefaults(
    defineProps<{
        recipient: EmailRecipient;
        email?: EmailPreview | null;
        getNext?: ((recipient: EmailRecipient) => EmailRecipient) | null;
        getPrevious?: ((recipient: EmailRecipient) => EmailRecipient) | null;
    }>(), {
        email: null,
        getNext: null,
        getPrevious: null,
    },
);
const { hasNext, hasPrevious, goBack, goForward } = useBackForward('recipient', props);
const present = usePresent();

const title = $t('%1FA');
const memberFetcher = useMembersObjectFetcher();

const deduplicatedOf: Ref<EmailRecipient[]> = ref([]);
const fetcher = useEmailRecipientsObjectFetcher();
const loadingDuplicates = ref(false);
const emailAddresSettings = ref<EmailAddressSettings | null>(null);
const loadingEmailAddresSettings = ref(false);
const context = useContext();
const auth = useAuth();
const owner = useRequestOwner();
const isRetrying = ref(false);

async function retrySending() {
    if (isRetrying.value) {
        return;
    }
    if (!await CenteredMessage.confirm(
        $t('%1Gm'),
        $t('%1Et'),
        $t('%1Gn'),
    )) {
        return;
    }
    isRetrying.value = true;
    const toast = new Toast($t('%1Go'), 'spinner');
    toast.setHide(null);
    toast.show();
    try {
        const response = await context.value.getAuthenticatedServerForOrganization(props.email?.organizationId ?? context.value.organization?.id ?? null).request({
            method: 'POST',
            path: '/email-recipients/' + props.recipient.id + '/retry',
            owner,
            shouldRetry: false,
            timeout: 60 * 15 * 1000, // 15 minutes,
            decoder: EmailRecipient as Decoder<EmailRecipient>,
        });
        toast.hide();
        if (response.data.sentAt) {
            Toast.success($t('%1Gp')).show();
        }
        else {
            Toast.warning($t('%1Gq')).show();
        }

        props.recipient.deepSet(response.data);
    }
    catch (e) {
        toast.hide();
        Toast.fromError(e).show();
    }
    finally {
        isRetrying.value = false;
    }
}

const members = computed(() => {
    return [props.recipient, ...deduplicatedOf.value].map(r => r.member).filter(m => !!m);
});
loadDuplicates().catch(console.error);

async function loadDuplicates() {
    if (loadingDuplicates.value) {
        return;
    }
    loadingDuplicates.value = true;
    try {
        const result = await fetcher.fetch(
            new LimitedFilteredRequest({
                filter: {
                    duplicateOfRecipientId: props.recipient.id,
                },
                limit: 100,
            }),
            { shouldRetry: true },
        );
        deduplicatedOf.value = result.results;
    }
    catch (e) {
        console.error('Failed to load duplicates', e);
        deduplicatedOf.value = [];
    }
    finally {
        loadingDuplicates.value = false;
    }
}

onMounted(() => {
    if (auth.hasPlatformFullAccess()) {
        loadEmailAddresSettings().catch(console.error);
    }
});

async function loadEmailAddresSettings() {
    if (loadingEmailAddresSettings.value || emailAddresSettings.value) {
        return;
    }
    loadingEmailAddresSettings.value = true;
    try {
        const response = await context.value.authenticatedIdentityServer.request({
            method: 'GET',
            path: '/email/manage',
            query: {
                email: props.recipient.email,
            },
            owner,
            shouldRetry: true,
            decoder: EmailAddressSettings as Decoder<EmailAddressSettings>,
        });
        emailAddresSettings.value = response.data;
    }
    catch (e) {
        console.error('Failed to load email address settings', e);
        emailAddresSettings.value = null;
    }
    finally {
        loadingEmailAddresSettings.value = false;
    }
}

const isUnblockingEmailAddress = ref(false);

async function unblockEmailAddress() {
    if (isUnblockingEmailAddress.value || !emailAddresSettings.value) {
        return;
    }
    if (!await CenteredMessage.confirm(
        $t('%1Gr'),
        $t('%1Gs'),
        $t('%1Gt'),
    )) {
        return;
    }

    isUnblockingEmailAddress.value = true;
    try {
        await context.value.authenticatedIdentityServer.request({
            method: 'POST',
            path: '/email/manage',
            body: {
                email: props.recipient.email,
                markedAsSpam: false,
                hardBounce: false,
            },
            owner,
            shouldRetry: false,
        });
        emailAddresSettings.value.markedAsSpam = false;
        emailAddresSettings.value.hardBounce = false;
        Toast.success(
            $t('%1Gu', { email: props.recipient.email || '' }),
        ).setIcon('unlock green').show();
    }
    catch (e) {
        console.error('Failed to unblock email address', e);
        Toast.fromError(e).show();
    }
    finally {
        isUnblockingEmailAddress.value = false;
    }
}

async function showMember(memberId: string) {
    const component = new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(PromiseView, {
            promise: async () => {
                const members = await memberFetcher.fetch(new LimitedFilteredRequest({
                    filter: {
                        id: memberId,
                    },
                    limit: 1,
                }));
                if (members.results.length === 0) {
                    Toast.error($t(`%yX`)).show();
                    throw new Error('Member not found');
                }
                return new ComponentWithProperties(MemberSegmentedView, {
                    member: members.results[0],
                });
            },
        }),
    });

    await present({
        components: [component],
        modalDisplayStyle: 'popup',
    });
}

</script>
