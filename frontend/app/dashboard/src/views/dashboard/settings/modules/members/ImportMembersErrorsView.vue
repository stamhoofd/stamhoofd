<template>
    <SaveView :title="$t('f9fec81d-9d00-4748-b92e-bb8526106c34')" :loading="saving" :save-text="$t('486a0b94-bed0-48d6-9055-3fe3923f8054')" @save="goNext">
        <h1>{{ $t('f9fec81d-9d00-4748-b92e-bb8526106c34') }}</h1>
        <p>{{ $t('a774b263-1900-4097-9b01-3b44577e9b35') }}</p>

        <table class="data-table">
            <thead>
                <tr>
                    <th>
                        {{ $t('9b327bf4-9928-4ad0-b9c5-71dee8631c8a') }}
                    </th>
                    <th>{{ $t('488b30da-0ba0-4bd1-b568-19404f2def34') }}</th>
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
