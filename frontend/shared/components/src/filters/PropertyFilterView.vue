<template>
    <SaveView :title="title" @save="save">
        <h1>
            {{ title }}
        </h1>
        <p v-if="options?.description">
            {{ options.description }}
        </p>

        <p v-if="options?.warning" class="warning-box">
            {{ options.warning }}
        </p>

        <p v-if="parentConfiguration && editingConfiguration" class="warning-box">
            {{ $t('%1Ir') }}
        </p>

        <!-- Todo: hier selector: nieuwe filter maken of bestaande filter bewerken, of opslaan als niewue filter -->
        <PropertyFilterInput v-model="editingConfiguration" :builder="builder" :required="!parentConfiguration" :disabled-text="$t('%1Is')" :disabled-description="parentConfiguration ? propertyFilterToString(parentConfiguration, builder) : ''" />
    </SaveView>
</template>

<script lang="ts" setup>
import { useDismiss } from '@simonbackx/vue-app-navigation';
import type { PropertyFilter } from '@stamhoofd/structures';
import { Version } from '@stamhoofd/structures';
import { shallowRef } from 'vue';

import { CenteredMessage } from '../overlays/CenteredMessage';
import PropertyFilterInput from './PropertyFilterInput.vue';
import type { UIFilterBuilder } from './UIFilter';
import { propertyFilterToString } from './UIFilter';

const props = withDefaults(defineProps<{
    title?: string;
    options?: { warning?: string; description?: string };
    builder: UIFilterBuilder;
    parentConfiguration?: PropertyFilter | null;
    configuration: PropertyFilter | null;
    setConfiguration: (configuration: PropertyFilter | null) => void;
}>(), {
    title: '',
    options: () => ({}),
    parentConfiguration: null,
});

const dismiss = useDismiss();
const editingConfiguration = shallowRef<PropertyFilter | null>(props.configuration);

async function save() {
    props.setConfiguration(editingConfiguration.value);
    await dismiss({ force: true });
}

function isChanged() {
    if (editingConfiguration.value === null || props.configuration === null) {
        return editingConfiguration.value !== props.configuration;
    }
    return JSON.stringify(editingConfiguration.value.encode({ version: Version })) !== JSON.stringify(props.configuration.encode({ version: Version }));
}

async function shouldNavigateAway() {
    if (!isChanged()) {
        return true;
    }
    return await CenteredMessage.confirm($t(`%A0`), $t(`%4X`));
}

defineExpose({ shouldNavigateAway });
</script>
