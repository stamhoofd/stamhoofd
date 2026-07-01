<template>
    <div class="st-view show-recovery-codes-view" data-testid="show-recovery-codes-view">
        <STNavigationBar :title="$t('Herstelcodes')" />

        <main class="center">
            <h1>{{ $t('Herstelcodes') }}</h1>
            <p>{{ $t('Bewaar deze herstelcodes op een veilige plaats. Je kan ze gebruiken om aan te melden als je je tweede factor verliest. Ze worden maar één keer getoond.') }}</p>

            <div class="recovery-codes" data-testid="recovery-codes">
                <code v-for="c of codes" :key="c">{{ c }}</code>
            </div>

            <button class="button text" type="button" @click.prevent="copy">
                <span class="icon copy" />
                <span>{{ $t('Kopieer codes') }}</span>
            </button>
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
import { useDismiss } from '@simonbackx/vue-app-navigation';

import STNavigationBar from '#navigation/STNavigationBar.vue';
import STToolbar from '#navigation/STToolbar.vue';
import { Toast } from '#overlays/Toast.ts';

const props = withDefaults(
    defineProps<{
        codes: string[];
        // Optional: run after the user acknowledges the codes (e.g. finish login / refresh).
        onCompleted?: (() => void | Promise<void>) | null;
    }>(), {
        onCompleted: null,
    },
);

const dismiss = useDismiss();

async function done() {
    await dismiss({ force: true });
    if (props.onCompleted) {
        await props.onCompleted();
    }
}

async function copy() {
    try {
        await navigator.clipboard.writeText(props.codes.join('\n'));
        Toast.success($t('Gekopieerd')).show();
    }
    catch (e) {
        console.error(e);
    }
}
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
