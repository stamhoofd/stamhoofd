<template>
    <div class="st-view show-recovery-codes-view" data-testid="show-recovery-codes-view">
        <STNavigationBar :title="$t('Herstelcodes')" />

        <main class="center">
            <h1>{{ $t('Herstelcodes') }}</h1>
            <p>{{ $t('Bewaar deze herstelcodes op een veilige plaats: bv. door ze af te drukken en in een kluis te bewaren. Je kan ze gebruiken om aan te melden als je de toegang tot je tweestapsverificatie-methode verliest (bv. bij een verloren smartphone). Ze worden maar één keer getoond.') }}</p>

            <div class="recovery-codes" data-testid="recovery-codes">
                <code v-for="c of codes" :key="c">{{ c }}</code>
            </div>

            <p class="style-button-bar">
                <button v-if="canPrint" class="button text" type="button" data-testid="print-recovery-codes" @click.prevent="print">
                    <span class="icon printer" />
                    <span>{{ $t('Afdrukken') }}</span>
                </button>

                <button class="button text" type="button" data-testid="copy-recovery-codes" @click.prevent="copy">
                    <span class="icon copy" />
                    <span>{{ $t('Kopieer codes') }}</span>
                </button>
            </p>
        </main>

        <STToolbar>
            <template #right>
                <button class="button primary" type="button" data-testid="recovery-codes-done" @click.prevent="done">
                    <span>{{ $t('Ik heb ze bewaard') }}</span>
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts" setup>
import { AppManager } from '@stamhoofd/networking/AppManager';
import { onUnmounted } from 'vue';

import { printRecoveryCodes } from '#auth/printRecoveryCodes.ts';
import { usePreventLeave } from '#hooks/usePreventLeave.ts';
import STNavigationBar from '#navigation/STNavigationBar.vue';
import STToolbar from '#navigation/STToolbar.vue';
import { CenteredMessage } from '#overlays/CenteredMessage.ts';
import { Toast } from '#overlays/Toast.ts';
import type { NavigationActions } from '#types/NavigationActions.ts';
import { useNavigationActions } from '#types/NavigationActions.ts';

const props = withDefaults(
    defineProps<{
        codes: string[];
        // Optional: run after the user acknowledges the codes (e.g. finish login / refresh).
        onCompleted?: ((navigation: NavigationActions) => void | Promise<void>) | null;
    }>(), {
        onCompleted: null,
    },
);

const navigationActions = useNavigationActions();

usePreventLeave(() => $t('Ben je zeker dat je de herstelcodes hebt opgeslagen?'));

let didComplete = false;

async function done() {
    if (!await CenteredMessage.confirm({
        title: $t('Heb je de codes zeker goed opgeslagen?'),
        description: $t('We raden je aan om de codes af te drukken en op een veilige plaats te bewaren'),
        confirmText: $t('Ja, ik heb ze bewaard'),
    })) {
        return;
    }
    didComplete = true;
    if (props.onCompleted) {
        await props.onCompleted(navigationActions);
    }
}

onUnmounted(() => {
    // The user closed this view in another way (back button, swipe, ...). The enrollment
    // is still finished by the caller, otherwise they'd be left in an unfinished flow.
    if (didComplete) {
        return;
    }
    didComplete = true;
    if (props.onCompleted) {
        Promise.resolve(props.onCompleted(navigationActions)).catch(console.error);
    }
});

async function copy() {
    try {
        await navigator.clipboard.writeText(props.codes.join('\n'));
        Toast.success($t('Gekopieerd')).show();
    } catch (e) {
        console.error(e);
    }
}

// The native app has no print dialog
const canPrint = !AppManager.shared.isNative;

function print() {
    try {
        printRecoveryCodes(props.codes);
    } catch (e) {
        console.error(e);
        Toast.error($t('Afdrukken is niet gelukt. Kopieer de codes en bewaar ze op een veilige plaats.')).show();
    }
}

const shouldNavigateAway = async () => {
    return await CenteredMessage.confirm($t('Ben je zeker dat je de herstelcodes hebt opgeslagen?'), $t('Ja, ik heb ze opgeslagen'), $t('We tonen deze codes maar één keer.'));
};

defineExpose({
    shouldNavigateAway,
});
</script>

<style lang="scss">
.show-recovery-codes-view {
    .recovery-codes {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
        margin: 16px 0;

        code {
            font-family: monospace;
            user-select: all;
            padding: 8px;
            background: var(--color-background-shade, #f5f5f5);
            border-radius: 6px;
            text-align: center;
        }
    }
}
</style>
