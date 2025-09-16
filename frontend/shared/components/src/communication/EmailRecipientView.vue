<template>
    <LoadingViewTransition>
        <div v-if="!loadingDuplicates" class="st-view">
            <STNavigationBar :title="title">
                <template #right>
                    <button v-if="hasPrevious || hasNext" type="button" class="button icon arrow-up" :disabled="!hasPrevious" :v-tooltip="$t('b72bff25-f6ff-4b0e-8338-32b551a5465a')" @click="goBack" />
                    <button v-if="hasNext || hasPrevious" type="button" class="button icon arrow-down" :disabled="!hasNext" :v-tooltip="$t('af69b2c9-849e-41a6-957e-adfdfb465959')" @click="goForward" />
                </template>
            </STNavigationBar>

            <main>
                <h1>
                    {{ title }}
                </h1>

                <p v-if="recipient.previousFailError && !recipient.failError" class="info-box">
                    {{ $t('Het versturen van deze e-mail was initieel mislukt (bv. geblokkeerd e-mailadres), maar het versturen werd daarna opnieuw geprobeerd en is nu wel gelukt.') }}
                </p>

                <p v-if="recipient.sentAt && emailAddresSettings && (emailAddresSettings.unsubscribedAll || emailAddresSettings.unsubscribedMarketing)" class="info-box">
                    <I18nComponent :t="$t('Deze ontvanger heeft zich na het ontvangen van deze e-mail uitgeschreven voor (een deel van) de e-mails die je verstuurt.')" />
                </p>

                <p v-if="recipient.spamComplaintError" class="error-box">
                    <I18nComponent :t="$t('5d83c1fc-37e5-4d57-8581-7a1f629c19b0')">
                        <template #button="{content}">
                            <a class="inline-link" :href="$domains.getDocs('spam-complaints')" target="_blank">
                                {{ content }}
                            </a>
                        </template>
                    </I18nComponent>
                </p>

                <p v-if="recipient.hardBounceError" class="error-box">
                    <I18nComponent :t="$t('cd537ed4-bd5f-4b0c-81d9-1cf09e0b104d')">
                        <template #button="{content}">
                            <a class="inline-link" :href="$domains.getDocs('bounces')" target="_blank">
                                {{ content }}
                            </a>
                        </template>
                    </I18nComponent>
                </p>

                <p v-if="recipient.softBounceError" class="warning-box">
                    <I18nComponent :t="$t('1db89db3-5838-4fd7-a7c4-d52d5478e033')">
                        <template #button="{content}">
                            <a class="inline-link" :href="$domains.getDocs('bounces')" target="_blank">
                                {{ content }}
                            </a>
                        </template>
                    </I18nComponent>
                </p>

                <p v-if="deduplicatedOf.length > 0" class="info-box">
                    {{ $t('5ac4d81e-fdd2-4699-8294-a5890ac34520') }}
                </p>

                <STList class="info">
                    <STListItem v-if="recipient.name || recipient.email">
                        <h3 class="style-definition-label">
                            {{ $t('88b9fe03-3b9c-4e35-a640-d0575dca0edc') }}
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
                            {{ $t('9603f7a2-14f0-4e9b-a191-0fddd8f6ec8a') }} {{ members.length > 1 ? `(${index + 1})` : '' }}
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
                            {{ $t('afd3a866-e08e-44da-a93b-ec2ece8cbb78') }}
                        </h3>
                        <p class="style-definition-text">
                            <span>{{ formatDateTime(recipient.sentAt) }}</span>
                        </p>
                    </STListItem>

                    <STListItem v-if="recipient.failError && isSoftEmailRecipientError(recipient.failError)" class="theme-warning">
                        <h3 class="style-definition-label">
                            <span style="color: var(--color-primary-dark);">{{ $t('fbdfafc8-9159-4848-abfd-123e044e7a38') }}</span><span class="icon warning tiny" />
                        </h3>
                        <p class="style-definition-text">
                            {{ recipient.failError.getHuman() }}
                        </p>
                    </STListItem>

                    <STListItem v-else-if="recipient.failError" class="theme-error">
                        <h3 class="style-definition-label">
                            <span>{{ $t('dc400a34-ce43-4e14-a292-6c9be0c0d131') }}</span><span class="icon error tiny" />
                        </h3>
                        <p class="style-definition-text">
                            {{ recipient.failError.getHuman() }}
                        </p>
                    </STListItem>

                    <STListItem v-if="recipient.hardBounceError" class="theme-error">
                        <h3 class="style-definition-label">
                            <span>{{ $t('b33eff3e-008a-4859-b2c7-dc84ae77a2f8') }}</span><span class="icon error tiny" />
                        </h3>
                        <template v-if="bounceErrorToHuman(recipient.hardBounceError)">
                            <p class="style-definition-text pre-wrap" v-text="bounceErrorToHuman(recipient.hardBounceError)" />
                            <p class="style-description-small pre-wrap" v-text="recipient.hardBounceError" />
                        </template>
                        <p v-else class="style-definition-text pre-wrap" v-text="recipient.hardBounceError" />
                    </STListItem>

                    <STListItem v-if="recipient.softBounceError" class="theme-warning">
                        <h3 class="style-definition-label">
                            <span style="color: var(--color-primary-dark);">{{ $t('c39fe846-065d-42b2-a34c-02147926d947') }}</span><span class="icon warning yellow tiny" />
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
                    <h2>{{ $t('7c093146-6de1-413b-bbda-2ada3fd63dea') }}</h2>

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
                                {{ $t('Blokkering opheffen') }}
                            </h3>
                            <p class="style-description-small">
                                {{ $t('Dit e-mailadres is momenteel geblokkeerd') }}
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
                                {{ $t('Niet (meer) geblokkeerd') }}
                            </h3>
                            <p class="style-description-small">
                                {{ $t('Dit e-mailadres is momenteel niet (meer) geblokkeerd') }}
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
                                {{ $t('Opnieuw proberen versturen') }}
                            </h3>
                            <p class="style-description-small">
                                {{ $t('Probeer de e-mail opnieuw te versturen naar deze ontvanger') }}
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
import { bounceErrorToHuman, EmailAddressSettings, EmailPreview, EmailRecipient, EmailStatus, isSoftEmailRecipientError, LimitedFilteredRequest } from '@stamhoofd/structures';
import { useAuth, useBackForward, useContext } from '../hooks';
import EmailPreviewBox from './components/EmailPreviewBox.vue';
import { I18nComponent } from '@stamhoofd/frontend-i18n';
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { LoadingViewTransition, PromiseView } from '../containers';
import { MemberSegmentedView } from '../members';
import { Toast } from '../overlays/Toast';
import { useEmailRecipientsObjectFetcher, useMembersObjectFetcher } from '../fetchers';
import { computed, onMounted, Ref, ref } from 'vue';
import { Decoder } from '@simonbackx/simple-encoding';
import { useRequestOwner } from '@stamhoofd/networking';
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

const title = $t('7a814201-064e-42a5-8c2d-1e0bd25717d7');
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
        $t('Weet je zeker dat je deze e-mail opnieuw wilt proberen te versturen?'),
        $t('Ja, opnieuw proberen'),
        $t('De e-mail zal opnieuw in de wachtrij worden geplaatst om verstuurd te worden. Dit kan enkele minuten duren.'),
    )) {
        return;
    }
    isRetrying.value = true;
    let toast = new Toast($t('Dit kan enkele minuten duren...'), 'spinner');
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
            Toast.success($t('De e-mail is opnieuw verzonden')).show();
        }
        else {
            Toast.warning($t('Het is niet gelukt om het bericht opnieuw te versturen')).show();
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
        $t('Weet je zeker dat je dit emailadres wilt deblokkeren?'),
        $t('Ja, deblokkeren'),
        $t('Zorg ervoor dat je enkel een e-mailadres deblokkeert als je zeker bent dat het probleem is opgelost en de persoon hierna geen spam meer zal melden.'),
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
            $t('{email} werd succesvol gedeblokkeerd', { email: props.recipient.email }),
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
                    Toast.error($t(`22541ecc-ba4f-4a91-b8d3-8213bfaaea0b`)).show();
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
