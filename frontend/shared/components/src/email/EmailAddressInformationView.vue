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
                            {{ $t('%1FK') }}
                        </h3>
                        <p v-copyable class="style-definition-text style-copyable">
                            <span>{{ emailInformation.email }}</span>
                        </p>
                    </STListItem>

                    <STListItem v-if="emailInformation.markedAsSpam" class="theme-warning">
                        <h3 class="style-definition-label">
                            <span>{{ $t('%1M9') }}</span><span class="icon warning tiny" />
                        </h3>
                        <p class="style-definition-text">
                            <I18nComponent :t="$t('%1MA')">
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
                            <span>{{ $t('%1F8') }}</span><span class="icon warning tiny" />
                        </h3>
                        <p class="style-definition-text">
                            <I18nComponent :t="$t('%1MB')">
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
                            <span>{{ $t('%1MC') }}</span><span class="icon warning tiny" />
                        </h3>
                        <p class="style-definition-text">
                            {{ $t('%1MD') }}
                        </p>
                    </STListItem>

                    <STListItem v-if="emailInformation.unsubscribedMarketing" class="theme-warning">
                        <h3 class="style-definition-label">
                            <span>{{ $t('%1ME') }}</span><span class="icon warning tiny" />
                        </h3>
                        <p class="style-definition-text">
                            {{ $t('%1MF') }}
                        </p>
                    </STListItem>
                </STList>

                <template v-if="canManageEmailAddress && wasBlocked">
                    <hr>
                    <h2>{{ $t('%16X') }}</h2>

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

                        <STListItem v-else-if="wasBlocked">
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
                    </STList>
                </template>
            </main>
        </div>
    </LoadingViewTransition>
</template>

<script setup lang="ts">
import I18nComponent from '@stamhoofd/frontend-i18n/I18nComponent';
import { LocalizedDomains } from '@stamhoofd/frontend-i18n/LocalizedDomains';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import type { EmailInformation } from '@stamhoofd/structures';
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

const title = $t('%1MG');

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
        $t('%1Gr'),
        $t('%1Gs'),
        $t('%1Gt'),
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
            $t('%1Gu', { email: props.emailInformation.email || '' }),
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
