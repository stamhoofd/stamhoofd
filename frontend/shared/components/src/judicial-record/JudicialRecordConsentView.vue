<template>
    <div class="st-view">
        <STNavigationBar :title="$t('Toestemming')" />

        <main>
            <p class="style-title-prefix">
                {{ $t('%1WP', { current: stepNumber.toString(), total: stepCount.toString() }) }}
            </p>

            <h1>
                {{ $t('Toestemming') }}
            </h1>

            <p>
                {{ onBehalfOfMember
                    ? $t('Om het uittreksel uit het strafregister van {member} te laten controleren, moet het gedeeld worden met {reviewer}. Lees hieronder wat er met het document gebeurt.', { member: member.patchedMember.firstName, reviewer })
                    : $t('Om je uittreksel uit het strafregister te laten controleren, moet je het delen met {reviewer}. Lees hieronder wat er met je document gebeurt.', { reviewer }) }}
            </p>

            <STList>
                <STListItem class="left-center">
                    <template #left>
                        <span class="icon user" />
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('Wie kan het bekijken?') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('Enkel de aangeduide controleurs van {reviewer}. Je eigen groepsleiding ziet enkel de status (bv. ‘In orde’).', { reviewer }) }}
                    </p>
                </STListItem>

                <STListItem class="left-center">
                    <template #left>
                        <span class="icon privacy" />
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('Waarvoor?') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('Enkel om na te gaan of je als leiding mag werken met minderjarigen.') }}
                    </p>
                </STListItem>

                <STListItem class="left-center">
                    <template #left>
                        <span class="icon clock" />
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('Hoe lang?') }}
                    </h3>
                    <p class="style-description-small">
                        {{ $t('Tot het gecontroleerd is, maximaal 3 maanden. Daarna wordt het document verwijderd.') }}
                    </p>
                </STListItem>
            </STList>

            <Checkbox v-model="consent" data-testid="judicial-record-consent">
                <I18nComponent :t="consentText">
                    <template #button="{ content }">
                        <a :href="privacyUrl!" class="inline-link" rel="nofollow noreferrer noopener" target="_blank">{{ content }}</a>
                    </template>
                </I18nComponent>
            </Checkbox>

            <template v-if="!$isMobile">
                <hr><p class="style-button-bar right-align">
                    <button class="button primary" type="button" :disabled="!consent" data-testid="judicial-record-continue" @click="goToDelivery">
                        <span>{{ $t('Doorgaan') }}</span>
                        <span class="icon arrow-right" />
                    </button>
                </p>
            </template>
        </main>

        <STToolbar v-if="$isMobile">
            <template #right>
                <button class="button primary" type="button" :disabled="!consent" data-testid="judicial-record-continue" @click="goToDelivery">
                    <span>{{ $t('Doorgaan') }}</span>
                    <span class="icon arrow-right" />
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script setup lang="ts">
import I18nComponent from '@stamhoofd/frontend-i18n/I18nComponent';
import { computed, ref } from 'vue';
import Checkbox from '../inputs/Checkbox.vue';
import STList from '../layout/STList.vue';
import STListItem from '../layout/STListItem.vue';
import { usePlatform } from '../hooks/usePlatform';
import STNavigationBar from '../navigation/STNavigationBar.vue';
import STToolbar from '../navigation/STToolbar.vue';
import { useNavigationActions } from '../types/NavigationActions';
import type { JudicialRecordStepProps } from './JudicialRecordStepProps';

const props = defineProps<JudicialRecordStepProps>();

const navigate = useNavigationActions();
const platform = usePlatform();
const consent = ref(false);

const reviewer = computed(() => STAMHOOFD.userMode === 'organization' ? $t('de organisatie') : $t('de koepel'));

/**
 * The document is shared with whoever reviews it, so link their privacy policy: the platform's in
 * platform mode, and otherwise the one of an organization the member is registered with.
 */
const privacyUrl = computed(() => {
    const platformPolicy = platform.value.config.privacy.policies[0];
    if (platformPolicy?.url) {
        return platformPolicy.url;
    }

    for (const organization of props.member.filterOrganizations({ currentPeriod: true })) {
        if (organization.meta.privacyPolicyUrl) {
            return organization.meta.privacyPolicyUrl;
        }
        if (organization.meta.privacyPolicyFile) {
            return organization.meta.privacyPolicyFile.getPublicPath();
        }
    }
    return null;
});

/**
 * The privacy policy is part of the sentence the member agrees to, not a footnote under it, so the
 * link is rendered inside the checkbox label. Clicking a link inside a label does not toggle the
 * checkbox: a label does nothing for clicks on interactive descendants.
 */
const consentText = computed(() => {
    const sentence = props.onBehalfOfMember
        ? $t('{member} gaf toestemming om het uittreksel uit het strafregister te delen met {reviewer} voor deze controle.', { member: props.member.patchedMember.firstName, reviewer: reviewer.value })
        : $t('Ik geef toestemming om mijn uittreksel uit het strafregister te delen met {reviewer} voor deze controle.', { reviewer: reviewer.value });

    if (!privacyUrl.value) {
        return sentence;
    }
    return sentence + ' <button>' + $t('Privacyverklaring') + '</button>';
});

async function goToDelivery() {
    await props.saveHandler(navigate);
}
</script>
