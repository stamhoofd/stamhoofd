<template>
    <LoadingViewTransition>
        <div class="st-view">
            <STNavigationBar :title="title" />

            <main>
                <h1>
                    {{ title }}
                </h1>

                <STList class="info">
                    <STListItem>
                        <h3 class="style-definition-label">
                            {{ $t('237d0720-13f0-4029-8bf2-4de7e0a9a358') }}
                        </h3>
                        <p v-copyable class="style-definition-text style-copyable">
                            <span>{{ emailInformation.email }}</span>
                        </p>
                    </STListItem>

                    <STListItem v-if="emailInformation.markedAsSpam" class="theme-warning">
                        <h3 class="style-definition-label">
                            <span>{{ $t('272e92e0-d532-4481-ac20-f752d7921007') }}</span><span class="icon warning tiny" />
                        </h3>
                        <p class="style-definition-text">
                            <I18nComponent :t="$t('351a0698-e182-410a-989f-a138325fab16')">
                                <template #button="{content}">
                                    <a class="inline-link" :href="LocalizedDomains.getDocs('spam-complaints')" target="_blank">
                                        {{ content }}
                                    </a>
                                </template>
                            </I18nComponent>
                        </p>
                    </STListItem>

                    <STListItem v-if="emailInformation.hardBounce" class="theme-warning">
                        <h3 class="style-definition-label">
                            <span>{{ $t('b33eff3e-008a-4859-b2c7-dc84ae77a2f8') }}</span><span class="icon warning tiny" />
                        </h3>
                        <p class="style-definition-text">
                            <I18nComponent :t="$t('0ee9632b-1462-4edf-9e68-abe77c8b9c8f')">
                                <template #button="{content}">
                                    <a class="inline-link" :href="LocalizedDomains.getDocs('bounces')" target="_blank">
                                        {{ content }}
                                    </a>
                                </template>
                            </I18nComponent>
                        </p>
                    </STListItem>

                    <STListItem v-if="emailInformation.unsubscribedAll" class="theme-warning">
                        <h3 class="style-definition-label">
                            <span>{{ $t('6b4e14de-9439-48d2-9be3-08611ca6f931') }}</span><span class="icon warning tiny" />
                        </h3>
                        <p class="style-definition-text">
                            {{ $t('24f0e13e-6e72-4045-8246-4063833ac36a') }}
                        </p>
                    </STListItem>

                    <STListItem v-if="emailInformation.unsubscribedMarketing" class="theme-warning">
                        <h3 class="style-definition-label">
                            <span>{{ $t('638979a6-27c7-4f17-a61b-5604d9f2900c') }}</span><span class="icon warning tiny" />
                        </h3>
                        <p class="style-definition-text">
                            {{ $t('79694c7e-c6d0-4548-989d-5bbd798e41dd') }}
                        </p>
                    </STListItem>
                </STList>

                <template v-if="canManageEmailAddress && wasBlocked">
                    <hr>
                    <h2>{{ $t('28d8fecc-3639-467b-90d5-1ac8e82240df') }}</h2>

                    <STList>
                        <STListItem v-if="isBlocked" :selectable="true" element-name="button" @click="unblockEmailAddress">
                            <template #left>
                                <IconContainer icon="email" class="error">
                                    <template #aside>
                                        <span class="icon unlock small stroke" />
                                    </template>
                                </IconContainer>
                            </template>
                            <h3 class="style-title-list">
                                {{ $t('93fb5220-c5dc-4fdf-b014-52238288207c') }}
                            </h3>
                            <p class="style-description-small">
                                {{ $t('c5706725-504c-44e7-bb39-b29df279a345') }}
                            </p>

                            <template #right>
                                <Spinner v-if="isUnblockingEmailAddress" />
                                <span v-else class="icon arrow-right-small gray" />
                            </template>
                        </STListItem>

                        <STListItem v-else-if="wasBlocked">
                            <template #left>
                                <IconContainer icon="email" class="theme-success">
                                    <template #aside>
                                        <span class="icon success small stroke" />
                                    </template>
                                </IconContainer>
                            </template>
                            <h3 class="style-title-list">
                                {{ $t('d04e6513-d40e-4888-8ea7-1b18c8721829') }}
                            </h3>
                            <p class="style-description-small">
                                {{ $t('15f327f6-3f58-446f-8e23-2470883133ce') }}
                            </p>
                        </STListItem>
                    </STList>
                </template>
            </main>
        </div>
    </LoadingViewTransition>
</template>

<script setup lang="ts">
import { I18nComponent, LocalizedDomains } from '@stamhoofd/frontend-i18n';
import { useRequestOwner } from '@stamhoofd/networking';
import { EmailInformation } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import IconContainer from '../icons/IconContainer.vue';
import { CenteredMessage } from '../overlays/CenteredMessage';
import { Toast } from '../overlays/Toast';
import { LoadingViewTransition } from '../containers';
import { useAuth } from '../hooks/useAuth';
import { useContext } from '../hooks/useContext';

const props = defineProps<{
    emailInformation: EmailInformation;
}>();

const title = $t('dd65290a-646f-4fed-9e0f-d0489b2c07c5');

const context = useContext();
const owner = useRequestOwner();

const isBlocked = computed(() => props.emailInformation.markedAsSpam || props.emailInformation.hardBounce);
const wasBlocked = isBlocked.value;

const auth = useAuth();
const canManageEmailAddress = computed(() => auth.hasFullAccess() || auth.hasPlatformFullAccess());

const isUnblockingEmailAddress = ref(false);

async function unblockEmailAddress() {
    if (isUnblockingEmailAddress.value) {
        return;
    }
    if (!await CenteredMessage.confirm(
        $t('24c3fee7-0709-4e61-91ec-a77010e6cee5'),
        $t('6f7e2f7f-c8ad-4ce4-8838-0d7ab855d72e'),
        $t('ea52e93e-6e9d-41d7-8b4c-9a5bc41440e7'),
    )) {
        return;
    }

    isUnblockingEmailAddress.value = true;
    try {
        await context.value.authenticatedServer.request({
            method: 'POST',
            path: '/email/manage',
            body: {
                email: props.emailInformation.email,
                markedAsSpam: false,
                hardBounce: false,
            },
            owner,
            shouldRetry: false,
        });

        props.emailInformation.markedAsSpam = false;
        props.emailInformation.hardBounce = false;

        Toast.success(
            $t('4a1a3ddf-3ae9-41a8-933f-bf0ca4726c11', { email: props.emailInformation.email || '' }),
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
</script>
