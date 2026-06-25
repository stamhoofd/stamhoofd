<template>
    <SaveView :title="$t('%1e5')" :save-text="$t('%KK')" @save="save">
        <h1>{{ $t('%1e5') }}</h1>
        <p>{{ $t('%1eX') }}</p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <NumberInputBox v-model="count" :title="$t('%1ef')" :validator="errors.validator" :min="1" :max="maxCount" />
    </SaveView>
</template>

<script lang="ts" setup>
import { usePop } from '@simonbackx/vue-app-navigation';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import NumberInputBox from '@stamhoofd/components/inputs/NumberInputBox.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import { ref } from 'vue';

const props = withDefaults(defineProps<{
    saveHandler: (count: number) => void;
    maxCount?: number;
}>(), {
    maxCount: 500,
});

const errors = useErrors();
const pop = usePop();
const count = ref<number | null>(Math.min(2, props.maxCount));

async function save() {
    const isValid = await errors.validator.validate();
    if (!isValid) {
        return;
    }

    props.saveHandler(count.value ?? 1);
    pop({ force: true })?.catch(console.error);
}
</script>
