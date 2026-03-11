<template>
    <SaveView :title="$t('%18e')" :loading="saving" :save-text="$t('%18f')" @save="goNext">
        <h1>{{ $t('%18e') }}</h1>
        <p>{{ $t('%18h') }}</p>

        <table class="data-table">
            <thead>
                <tr>
                    <th>
                        {{ $t('%18i') }}
                    </th>
                    <th>{{ $t('%18j') }}</th>
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
