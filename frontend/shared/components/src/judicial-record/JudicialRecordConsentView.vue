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
                        {{ $t('Enkel de aangeduide controleurs van {reviewer}, beheerders zien enkel de status (bv. ‘In orde’).', { reviewer }) }}
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
                        {{ $t('Enkel om na te gaan of je mag werken met minderjarigen.') }}
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
            <hr>
            <Checkbox v-model="consent" data-testid="judicial-record-consent">
                <I18nComponent :t="consentText">
                    <template #button="{ content }">
                        <a :href="privacy?.url!" class="inline-link" rel="nofollow noreferrer noopener" target="_blank">{{ content }}</a>
                    </template>
                </I18nComponent>
            </Checkbox>

            <template v-if="!$isMobile">
                <p class="style-button-bar right-align">
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
const privacy = computed(() => {
    const platformPolicy = platform.value.config.privacy.policies[0];
    if (platformPolicy?.url) {
        return {
            url: platformPolicy.url,
            name: platformPolicy.name || $t('Privacyverklaring'),
        };
    }

    for (const organization of props.member.filterOrganizations({ currentPeriod: true })) {
        if (organization.meta.privacyPolicyUrl) {
            return {
                url: organization.meta.privacyPolicyUrl,
                name: $t('Privacyverklaring'),
            };
        }
        if (organization.meta.privacyPolicyFile) {
            return {
                url: organization.meta.privacyPolicyFile.getPublicPath(),
                name: $t('Privacyverklaring'),
            };
        }
    }
    return null;
});

/**
 * The privacy policy is part of the sentence the member agrees to, not a footnote under it, so the
 * link goes inside the checkbox label. A label does nothing for clicks on interactive descendants,
 * so the link does not toggle the checkbox.
 */
const consentText = computed(() => {
    const sentence = props.onBehalfOfMember
        ? $t('{member} gaf toestemming om het uittreksel uit het strafregister te delen met {reviewer} voor deze controle.', { member: props.member.patchedMember.firstName, reviewer: reviewer.value })
        : $t('Ik geef toestemming om mijn uittreksel uit het strafregister te delen met {reviewer} voor deze controle.', { reviewer: reviewer.value });

    if (!privacy.value) {
        return sentence;
    }
    return sentence + ' <button>' + privacy.value.name + '</button>';
});

async function goToDelivery() {
    await props.saveHandler(navigate);
}
</script>
