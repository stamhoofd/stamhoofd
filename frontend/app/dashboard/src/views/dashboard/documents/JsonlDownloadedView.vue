<template>
    <div class="st-view">
        <STNavigationBar :title="$t('Belcotax')" />

        <main>
            <h1>{{ $t('Bestand gedownload') }}</h1>

            <ul class="style-list">
                <li>{{ $t('Meld aan bij Belcotax-on-web (itsme of eID).') }}</li>
                <li>{{ $t('Kies Zending per bestand en laad {fileName} op.', { fileName }) }}</li>
                <li>{{ $t('Krijg je een fout met een sleutel (STA-{year}-…)? Plak die in de zoekbalk van Documenten.', { year: year.toString() }) }}</li>
                <li>{{ $t('Iets gewijzigd of geannuleerd? Download opnieuw en laad het volledige bestand opnieuw op. Belcotax overschrijft en verwijdert wat nodig is.') }}</li>
            </ul>
        </main>

        <STToolbar>
            <template #right>
                <button class="button primary" type="button" @click="dismiss()">
                    {{ $t('Sluiten') }}
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts" setup>
import { useDismiss } from '@browser/navigation';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import STToolbar from '@stamhoofd/components/navigation/STToolbar.vue';

defineProps<{
    fileName: string;
    year: number;
}>();

const dismiss = useDismiss();
</script>
