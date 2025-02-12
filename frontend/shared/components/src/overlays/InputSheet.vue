<template>
    <SaveView :title="title" :loading="saving" :save-text="saveText" @save="save">
        <h1>
            {{ title }}
        </h1>
        <p v-if="description">
            {{ description }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <textarea
            v-if="props.multiline"
            ref="firstInput"
            v-model="value"
            class="input"
            :placeholder="placeholder"
            autocomplete=""
        />

        <input
            v-else
            ref="firstInput"
            v-model="value"
            class="input"
            type="text"
            :placeholder="placeholder"
            autocomplete=""
        >
    </SaveView>
</template>

<script lang="ts" setup>
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, useErrors } from '@stamhoofd/components';
import { computed, ref } from 'vue';

const props = withDefaults(
    defineProps<{
        title: string;
        description?: string;
        placeholder?: string;
        defaultValue?: string;
        multiline?: boolean;
        saveText?: string;
        saveHandler: (value: string) => Promise<void> | void;
    }>(), {
        description: '',
        placeholder: '',
        defaultValue: '',
        saveText: undefined,
        multiline: false,
    });

const errors = useErrors();
const value = ref(props.defaultValue);
const saving = ref(false);
const pop = usePop();

async function save() {
    if (saving.value) {
        return;
    }
    saving.value = true;
    try {
        await props.saveHandler(value.value);
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    saving.value = false;
}

const hasChanges = computed(() => {
    return value.value !== props.defaultValue;
});

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('996a4109-5524-4679-8d17-6968282a2a75'), $t('106b3169-6336-48b8-8544-4512d42c4fd6'));
};

defineExpose({
    shouldNavigateAway,
});

</script>
