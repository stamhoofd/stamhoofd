<template>
    <SaveView :title="$t('f9fec81d-9d00-4748-b92e-bb8526106c34')" :loading="saving" :save-text="$t('486a0b94-bed0-48d6-9055-3fe3923f8054')" @save="goNext">
        <h1>{{ $t('becf7e84-6ea6-4dc9-b6cd-f2c5c56c47ac') }}</h1>

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
