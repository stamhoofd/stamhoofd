<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save" v-on="!isNew && deleteHandler ? {delete: deleteMe} : {}">
        <div class="container">
            <h1>{{ title }}</h1>

            <STErrorsDefault :error-box="errors.errorBox" />

            <STInputBox :title="$t('9ffdbf7d-83b1-45e3-8ad5-db07b4a22d1e')" error-fields="name" :error-box="errors.errorBox">
                <input
                    id="premise-name"
                    v-model="name"
                    class="input"
                    type="text"
                    :placeholder="$t('8505e377-cc4d-4551-98d3-60a70d8b2c7b')"
                    autocomplete="off"
                >
            </STInputBox>

            <STInputBox :title="$t('1c338881-0940-429b-a47e-7c9d3055f533')" error-fields="description" :error-box="errors.errorBox" class="max">
                <textarea
                    id="premise-description"
                    v-model="description"
                    class="input"
                    type="text"
                    :placeholder="$t('13650793-84d9-407a-b477-79b40011441d')"
                    autocomplete="off"
                />
            </STInputBox>

            <AddressInput v-model="address" :title="$t('622c0dd7-cddd-4417-9bfd-5f6aca2480f5')" :validator="errors.validator" :required="true" :link-country-to-locale="true" error-fields="address" />

            <div v-if="platformPremiseTypes.length || originalPremiseTypeIds.size" class="container">
                <hr>
                <h2>Type</h2>
                <STList>
                    <STListItem v-for="premiseType of platformPremiseTypes" :key="premiseType.id" :selectable="true" element-name="label" class="hover-box">
                        <template #left>
                            <Checkbox :model-value="isPremiseTypeSelected(premiseType)" :disabled="isPremiseTypeDisabled(premiseType)" @update:model-value="($event: boolean) => selectPremiseType($event, premiseType)" />
                        </template>
                        <div class="checkbox-label">
                            <h2 class="style-title-list">
                                {{ premiseType.name }}
                            </h2>
                            <p v-if="premiseType.description" class="style-description-small">
                                {{ premiseType.description }}
                            </p>
                        </div>

                        <template #right>
                            <span v-if="premiseTypeWarnings.has(premiseType.id)" v-tooltip="premiseTypeWarnings.get(premiseType.id)" class="icon warning yellow" />
                            <span v-else-if="isPremiseTypeDisabled(premiseType)" v-tooltip="'Het maximum aantal van dit type is bereikt. Verwijder eerst een ander lokaal van dit type om dit type te selecteren.'" class="icon info-circle hover-show" />
                        </template>
                    </STListItem>
                    <STListItem v-if="hasUnknownType" :selectable="true" element-name="label">
                        <template #left>
                            <Checkbox :model-value="isUnknownTypeSelected" @update:model-value="selectUnkownType" />
                        </template>
                        <div class="checkbox-label">
                            <h2 class="style-title-list">
                                Onbekend
                            </h2>
                            <p class="style-description-small">
                                Dit type lokaal is onbekend. Waarschijnlijk is deze verwijderd.
                            </p>
                        </div>
                    </STListItem>
                </STList>
            </div>
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { AddressInput, SaveView, useEditPopup, useErrors, usePlatform } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { PlatformPremiseType, Premise } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

const props = withDefaults(
    defineProps<{
        premise: Premise;
        isNew: boolean;
        saveHandler: (premise: AutoEncoderPatchType<Premise>) => Promise<void>;
        deleteHandler?: (() => Promise<void>) | null;
        premiseTypeCount: Map<string, { type: PlatformPremiseType; count: number }>;
    }>(),
    {
        deleteHandler: null,
    },
);

const $t = useTranslate();

const title = computed(() => props.isNew ? $t('5e40dfe9-b4ed-497c-a37d-e162191ba96a') : $t('09186fb9-2c94-4425-95e7-66cc2fd398ff'));
const errors = useErrors();
const platform$ = usePlatform();

const { saving, doDelete, hasChanges, save, patched, addPatch, shouldNavigateAway } = useEditPopup({
    errors,
    saveHandler: props.saveHandler,
    deleteHandler: props.deleteHandler,
    toPatch: props.premise,
});

const platformPremiseTypes = computed(() => platform$.value.config.premiseTypes);
const premiseTypeWarnings = ref<Map<string, string>>(new Map());

const name = computed({
    get: () => patched.value.name,
    set: (name) => {
        addPatch({ name });
    },
});

const description = computed({
    get: () => patched.value.description,
    set: (description) => {
        addPatch({ description });
    },
});

const address = computed({
    get: () => patched.value.address,
    set: (address) => {
        addPatch({ address });
    },
});

const premiseTypeIds = computed({
    get: () => patched.value.premiseTypeIds,
    set: (premiseTypeIds) => {
        addPatch({ premiseTypeIds: premiseTypeIds as any });
    },
});

const originalPremiseTypeIds = new Set(patched.value.premiseTypeIds);

// #region unknown types
const distinctPlatformTypeIds = new Set(platformPremiseTypes.value.map(type => type.id));
const unknownTypeIds = Array.from(originalPremiseTypeIds).filter(id => !distinctPlatformTypeIds.has(id));
const hasUnknownType = unknownTypeIds.length > 0;
const isUnknownTypeSelected = ref(hasUnknownType);

function selectUnkownType(isSelected: boolean) {
    const knownTypeIds = premiseTypeIds.value.filter(id => distinctPlatformTypeIds.has(id));

    if (isSelected) {
        premiseTypeIds.value = knownTypeIds.concat(unknownTypeIds);
    }
    else {
        premiseTypeIds.value = knownTypeIds;
    }

    isUnknownTypeSelected.value = isSelected;
}
// #endregion

function selectPremiseType(isSelected: boolean, premiseType: PlatformPremiseType) {
    const premiseTypeId = premiseType.id;

    if (isSelected) {
        if (premiseTypeIds.value.includes(premiseTypeId)) {
            console.error(`${premiseType.name} is already selected`);
        }
        else {
            premiseTypeIds.value = [...premiseTypeIds.value, premiseTypeId];
        }
    }
    else {
        premiseTypeIds.value = premiseTypeIds.value.filter(id => id !== premiseTypeId);
    }

    updatePremiseTypeWarnings();
}

function isPremiseTypeSelected(premiseType: PlatformPremiseType) {
    return premiseTypeIds.value.includes(premiseType.id);
}

function isPremiseTypeDisabled(premiseType: PlatformPremiseType) {
    const max = premiseType.max;
    const min = premiseType.min;
    if (max === null && min === null) return false;

    const premiseTypeId = premiseType.id;

    const typeCount = props.premiseTypeCount.get(premiseTypeId);

    if (!typeCount) {
        console.error(`Premise type ${premiseTypeId} not found in premiseTypeCount`);
        return;
    }

    const count = typeCount.count;

    if (max !== null && count >= max && !originalPremiseTypeIds.has(premiseTypeId)) {
        return true;
    }

    return false;
}

function updatePremiseTypeWarnings() {
    const currentPremiseTypeIds = new Set(premiseTypeIds.value);
    const warnings = new Map<string, string>();

    for (const [id, { count, type }] of props.premiseTypeCount.entries()) {
        const isSelected = currentPremiseTypeIds.has(id);
        if (isSelected) continue;
        const wasSelected = originalPremiseTypeIds.has(id);
        const isChanged = isSelected !== wasSelected;
        if (isChanged) {
            const min = type.min;

            if (min !== null && count <= min) {
                const message = `Het minimum aantal van deze soort is ${min}.`;
                warnings.set(id, message);
            }
        }
    }

    premiseTypeWarnings.value = warnings;
}

async function deleteMe() {
    await doDelete('Ben je zeker dat je dit lokaal wil verwijderen?');
}

defineExpose({
    shouldNavigateAway,
});
</script>

<style lang="scss" scoped>
.checkbox-label {
    min-height: 24px;
    display: flex;
    flex-direction: column;
    justify-content: center;
}
</style>
