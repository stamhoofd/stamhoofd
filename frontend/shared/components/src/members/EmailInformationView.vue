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
                            {{ $t('E-mailadres') }}
                        </h3>
                        <p v-copyable class="style-definition-text style-copyable">
                            <span>{{ emailInformation.email }}</span>
                        </p>
                    </STListItem>

                    <STListItem v-if="emailInformation.markedAsSpam" class="theme-warning">
                        <h3 class="style-definition-label">
                            <span>{{ $t('Als spam gemarkeerd') }}</span><span class="icon warning tiny" />
                        </h3>
                        <p class="style-definition-text">
                            <I18nComponent :t="$t('De ontvanger heeft eerder een e-mail als spam gemarkeerd. Hierdoor worden geen e-mails meer verzonden naar dit e-mailadres. <button>Meer info</button>')">
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
                            <span>{{ $t('Hard bounce') }}</span><span class="icon warning tiny" />
                        </h3>
                        <p class="style-definition-text">
                            <I18nComponent :t="$t('Een e-mail kon eerder niet worden verzonden omwille van een permanenten reden (= hard bounce). Hierdoor worden geen e-mails meer verzonden naar dit e-mailadres. <button>Meer info</button>')">
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
                            <span>{{ $t('Afgemeld voor alle e-mails') }}</span><span class="icon warning tiny" />
                        </h3>
                        <p class="style-definition-text">
                            {{ $t('De ontvanger heeft zich afgemeld voor alle e-mails.') }}
                        </p>
                    </STListItem>

                    <STListItem v-if="emailInformation.unsubscribedMarketing" class="theme-warning">
                        <h3 class="style-definition-label">
                            <span>{{ $t('Afgemeld voor marketing e-mails') }}</span><span class="icon warning tiny" />
                        </h3>
                        <p class="style-definition-text">
                            {{ $t('De ontvanger heeft zich afgemeld voor marketing e-mails.') }}
                        </p>
                    </STListItem>
                </STList>

                <template v-if="canManageEmailAddress && wasBlocked">
                    <hr>
                    <h2>{{ $t('7c093146-6de1-413b-bbda-2ada3fd63dea') }}</h2>

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
import { LoadingViewTransition } from '../containers';
import { useAuth, useContext } from '../hooks';
import IconContainer from '../icons/IconContainer.vue';
import { CenteredMessage } from '../overlays/CenteredMessage';
import { Toast } from '../overlays/Toast';

const props = defineProps<{
    emailInformation: EmailInformation;
}>();

const title = $t('E-mailadres beheren');

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
        await context.value.authenticatedIdentityServer.request({
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
