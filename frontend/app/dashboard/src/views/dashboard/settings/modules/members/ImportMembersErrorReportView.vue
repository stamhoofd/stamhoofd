<template>
    <SaveView :title="$t('%18e')" :loading="saving" :save-text="$t('%18f')" @save="goNext">
        <h1>{{ $t('%18g') }}</h1>

        <STList>
            <STListItem v-for="report in reports" :key="report.row">
                <template #left>
                    <span v-if="report.errorMessage" class="icon error" />
                    <span v-else class="icon success" />
                </template>

                <h3 class="style-title-list">
                    {{ report.name }}
                </h3>

                <p v-if="report.errorMessage" class="style-description-small">
                    {{ report.errorMessage }}
                </p>
            </STListItem>
        </STList>

        <STErrorsDefault :error-box="errors.errorBox" />
    </SaveView>
</template>

<script lang="ts" setup>
import { usePop } from '@simonbackx/vue-app-navigation';
import { STErrorsDefault, useErrors } from '@stamhoofd/components';
import { ref } from 'vue';
import { MemberImportReport } from './MemberImportReport';

const props = defineProps<{
    reports: MemberImportReport[];
    onNext: () => void;
}>();

const pop = usePop();

const errors = useErrors();

const saving = ref(false);

function goNext() {
    pop()?.then(() => props.onNext()).catch(console.error);
}
</script>
