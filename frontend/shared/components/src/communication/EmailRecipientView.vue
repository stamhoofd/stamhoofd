<template>
    <div class="st-view">
        <STNavigationBar :title="title">
            <template #right>
                <button v-if="hasPrevious || hasNext" type="button" class="button icon arrow-up" :disabled="!hasPrevious" :v-tooltip="$t('Vorige ontvanger')" @click="goBack" />
                <button v-if="hasNext || hasPrevious" type="button" class="button icon arrow-down" :disabled="!hasNext" :v-tooltip="$t('Volgende ontvanger')" @click="goForward" />
            </template>
        </STNavigationBar>

        <main>
            <h1>
                {{ title }}
            </h1>

            <p v-if="recipient.spamComplaintError" class="error-box">
                <I18nComponent :t="$t('Deze ontvanger heeft deze e-mail als spam gemarkeerd. Deze persoon werd daardoor automatisch geblokkeerd en zal geen e-mails meer ontvangen. <button>Meer info</button>')">
                    <template #button="{content}">
                        <a class="inline-link" :href="$domains.getDocs('spam-complaints')" target="_blank">
                            {{ content }}
                        </a>
                    </template>
                </I18nComponent>
            </p>

            <p v-if="recipient.hardBounceError" class="error-box">
                <I18nComponent :t="$t('De e-mail kwam automatisch terug omwille van een permanente reden (zie onder). Deze persoon werd daardoor automatisch geblokkeerd en zal geen e-mails meer ontvangen. <button>Meer info</button>')">
                    <template #button="{content}">
                        <a class="inline-link" :href="$domains.getDocs('bounces')" target="_blank">
                            {{ content }}
                        </a>
                    </template>
                </I18nComponent>
            </p>

            <p v-if="recipient.softBounceError" class="warning-box">
                <I18nComponent :t="$t('De e-mail kwam automatisch terug omwille van een tijdelijke reden (zie onder). <button>Meer info</button>')">
                    <template #button="{content}">
                        <a class="inline-link" :href="$domains.getDocs('bounces')" target="_blank">
                            {{ content }}
                        </a>
                    </template>
                </I18nComponent>
            </p>

            <STList class="info">
                <STListItem v-if="recipient.name">
                    <h3 class="style-definition-label">
                        {{ $t('Naam') }}
                    </h3>
                    <p class="style-definition-text">
                        <span>{{ capitalizeFirstLetter(recipient.name) }}</span>
                    </p>
                </STListItem>

                <STListItem v-if="recipient.email">
                    <h3 class="style-definition-label">
                        {{ $t('E-mailadres') }}
                    </h3>
                    <p v-copyable class="style-definition-text style-copyable">
                        <span>{{ recipient.email }}</span>
                    </p>
                </STListItem>

                <STListItem v-if="recipient.sentAt">
                    <h3 class="style-definition-label">
                        {{ $t('Verzonden op') }}
                    </h3>
                    <p class="style-definition-text">
                        <span>{{ formatDateTime(recipient.sentAt) }}</span>
                    </p>
                </STListItem>

                <STListItem v-if="recipient.failError" class="theme-error">
                    <h3 class="style-definition-label">
                        <span>{{ $t('Fout bij versturen') }}</span><span class="icon error tiny" />
                    </h3>
                    <p class="style-definition-text">
                        {{ recipient.failError.getHuman() }}
                    </p>
                </STListItem>

                <STListItem v-if="recipient.hardBounceError" class="theme-error">
                    <h3 class="style-definition-label">
                        <span>{{ $t('Hard bounce') }}</span><span class="icon error tiny" />
                    </h3>
                    <template v-if="bounceErrorToHuman(recipient.hardBounceError)">
                        <p class="style-definition-text pre-wrap" v-text="bounceErrorToHuman(recipient.hardBounceError)" />
                        <p class="style-description-small pre-wrap" v-text="recipient.hardBounceError" />
                    </template>
                    <p v-else class="style-definition-text pre-wrap" v-text="recipient.hardBounceError" />
                </STListItem>

                <STListItem v-if="recipient.softBounceError" class="theme-warning">
                    <h3 class="style-definition-label">
                        <span>{{ $t('Soft bounce') }}</span><span class="icon warning yellow tiny" />
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
</template>

<script setup lang="ts">
import { bounceErrorToHuman, EmailPreview, EmailRecipient } from '@stamhoofd/structures';
import { useBackForward } from '../hooks';
import EmailPreviewBox from './components/EmailPreviewBox.vue';
import { I18nComponent } from '@stamhoofd/frontend-i18n';

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

const title = $t('Ontvanger');

</script>
