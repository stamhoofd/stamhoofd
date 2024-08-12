<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save">
        <div class="container">
            <h1>{{ title }}</h1>

            <p class="style-description-block">
                Lorem ipsum dolor sit amet consectetur adipisicing elit. Voluptates assumenda dolore doloribus cum molestiae minima cumque impedit, cupiditate architecto dolor consequatur repudiandae rerum deserunt dolorum, accusantium sit at iure recusandae!
            </p>

            <div class="container">
                <h2>Adres</h2>
                <AddressInput v-model="address" title="" :validator="errors.validator" :link-country-to-locale="true" />
            </div>
        
            <template v-if="premiseTypes.length">
                <hr>
                <div class="container">
                    <h2>Soort</h2>
                    <STList>
                        <STListItem v-for="premiseType of premiseTypes" :key="premiseType.id" :selectable="true" element-name="label">
                            <template #left>
                                <Checkbox :model-value="premiseTypeIds.includes(premiseType.id)" @update:model-value="($event: boolean) => selectPremiseType($event, premiseType)" />
                            </template>
                            <h2 class="style-title-list">
                                {{ premiseType.name }}
                            </h2>
                            <p v-if="premiseType.description" class="style-description-small">{{ premiseType.description }}</p>
                        </STListItem>
                    </STList>
                </div>
            </template>
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { AddressInput, SaveView, useErrors, usePlatform } from "@stamhoofd/components";
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { PlatformPremiseType, Premise } from "@stamhoofd/structures";
import { computed } from 'vue';
import { useEditPopup } from '../../../../../../shared/composables/editPopup';

const props = withDefaults(
    defineProps<{
        premise: Premise;
        isNew: boolean;
        saveHandler: (premise: AutoEncoderPatchType<Premise>) => Promise<void>;
        deleteHandler?: (() => Promise<void>)|null;
        showToasts?: boolean;
    }>(),
    {
        deleteHandler: null,
    }
);

const $t = useTranslate();

const title = computed(() => props.isNew ? $t('Nieuw gebouw') : $t('Wijzig gebouw'));
const errors = useErrors();
const platform$ = usePlatform();

const {saving, hasChanges, save, patched, addPatch, shouldNavigateAway} = useEditPopup({
    errors,
    saveHandler: props.saveHandler,
    deleteHandler: props.deleteHandler,
    toPatch: props.premise
});

const premiseTypes = computed(() => platform$.value.config.premiseTypes);

const premiseTypeIds = computed({
    get: () => patched.value.premiseTypeIds,
    set: (premiseTypeIds) => {
        addPatch({premiseTypeIds: premiseTypeIds as any});
    }
});

function selectPremiseType(isSelected: boolean, premiseType: PlatformPremiseType) {
    const premiseTypeId = premiseType.id;

    if(isSelected) {
        if(premiseTypeIds.value.includes(premiseTypeId)) {
            console.error(`${premiseType.name} is already selected`);
        } else {
            premiseTypeIds.value = [...premiseTypeIds.value, premiseTypeId];
        }
    } else {
        premiseTypeIds.value = premiseTypeIds.value.filter(id => id !== premiseTypeId);
    }
}

const address = computed({
    get: () => patched.value.address,
    set: (address) => {
        addPatch({address});
    }
})

defineExpose({
    shouldNavigateAway
});
</script>
