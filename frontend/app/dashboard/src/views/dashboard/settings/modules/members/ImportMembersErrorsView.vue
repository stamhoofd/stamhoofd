<template>
    <SaveView :title="$t('Kijk deze fouten na')" :loading="saving" :save-text="$t('Nieuw bestand uploaden')" @save="goNext">
        <h1>{{ $t('Kijk deze fouten na') }}</h1>
        <p>{{ $t('In sommige rijen hebben we gegevens gevonden die we niet 100% goed konden interpreteren. Kijk hieronder na waar je nog wijzigingen moet aanbrengen en pas het aan in jouw bestand.') }}</p>

        <table class="data-table">
            <thead>
                <tr>
                    <th>
                        {{ $t('Fout') }}
                    </th>
                    <th>{{ $t('Cel') }}</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="(error, index) in importErrors" :key="index">
                    <td>
                        {{ error.message }}
                    </td>
                    <td class="nowrap">
                        {{ error.cellPath }}
                    </td>
                </tr>
            </tbody>
        </table>

        <STErrorsDefault :error-box="errors.errorBox"/>
    </SaveView>
</template>

<script lang="ts" setup>
import { usePop } from '@simonbackx/vue-app-navigation';
import { STErrorsDefault, useErrors } from '@stamhoofd/components';
import { ref } from 'vue';
import { ImportError } from '../../../../../classes/import/ImportError';

defineProps<{
    importErrors: ImportError[];
}>();

const errors = useErrors();
const pop = usePop();

const saving = ref(false);

function goNext() {
    pop()?.catch(console.error);
}
</script>
