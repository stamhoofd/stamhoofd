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
            </STList>

            <EmailPreviewBox v-if="email && recipient.sentAt" :email="email" :recipient="recipient" />
        </main>
    </div>
</template>

<script setup lang="ts">
import { EmailPreview, EmailRecipient } from '@stamhoofd/structures';
import { useBackForward } from '../hooks';
import EmailPreviewBox from './components/EmailPreviewBox.vue';

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
