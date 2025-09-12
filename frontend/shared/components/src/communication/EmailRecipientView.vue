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
            </main>
        </div>
    </LoadingViewTransition>
</template>

<script setup lang="ts">
import { bounceErrorToHuman, EmailPreview, EmailRecipient, isSoftEmailRecipientError, LimitedFilteredRequest } from '@stamhoofd/structures';
import { useBackForward, useContext } from '../hooks';
import EmailPreviewBox from './components/EmailPreviewBox.vue';
import { I18nComponent } from '@stamhoofd/frontend-i18n';
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { LoadingViewTransition, PromiseView } from '../containers';
import { MemberSegmentedView } from '../members';
import { Toast } from '../overlays/Toast';
import { useEmailRecipientsObjectFetcher, useMembersObjectFetcher } from '../fetchers';
import { computed, onMounted, Ref, ref } from 'vue';

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
