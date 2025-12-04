<template>
    <STErrorsDefault :error-box="errors.errorBox" />

    <STList v-model="model" :draggable="true">
        <template #item="{item: type}">
            <PremiseTypeRow :type="type" @click="editType(type)" />
        </template>
    </STList>

    <p>
        <button class="button text" type="button" @click="addType">
            <span class="icon add" />
            <span>{{ $t('8daed6fc-e3dd-4b6b-bd78-c79add8edfb9') }}</span>
        </button>
    </p>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { useErrors } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { PlatformPremiseType } from '@stamhoofd/structures';
import EditBuildingTypeView from './EditPremiseTypeView.vue';
import PremiseTypeRow from './components/PremiseTypeRow.vue';

const errors = useErrors();
const present = usePresent();

const props = defineProps<{
    addArrayPatch: (value: PatchableArrayAutoEncoder<PlatformPremiseType>) => void;
}>();

const model = defineModel<PlatformPremiseType[]>({
    required: true,
});

async function addType() {
    const arr: PatchableArrayAutoEncoder<PlatformPremiseType> = new PatchableArray();
    const type = PlatformPremiseType.create({});
    arr.addPut(type);

    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditBuildingTypeView, {
                type,
                isNew: true,
                saveHandler: (patch: AutoEncoderPatchType<PlatformPremiseType>) => {
                    patch.id = type.id;
                    arr.addPatch(patch);
                    props.addArrayPatch(arr);
                },
            }),
        ],
    });
}

async function editType(type: PlatformPremiseType) {
    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditBuildingTypeView, {
                type,
                isNew: false,
                saveHandler: (patch: AutoEncoderPatchType<PlatformPremiseType>) => {
                    const arr: PatchableArrayAutoEncoder<PlatformPremiseType> = new PatchableArray();
                    arr.addPatch(patch);
                    props.addArrayPatch(arr);
                },
                deleteHandler: () => {
                    const arr: PatchableArrayAutoEncoder<PlatformPremiseType> = new PatchableArray();
                    arr.addDelete(type.id);
                    props.addArrayPatch(arr);
                },
            }),
        ],
    });
}
</script>
