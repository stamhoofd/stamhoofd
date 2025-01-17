<template>
    <div>
        <STList v-if="locations.length > 0">
            <STListItem v-for="_location in locations" :key="_location.id" element-name="label" :selectable="true" class="left-center location-selection">
                <template #left>
                    <Radio v-model="selectedLocation" :value="_location" @change="changeSelected" />
                </template>
                <h3 class="style-title-list">
                    {{ _location.name }}
                </h3>
                <p v-if="_location.address" class="style-description">
                    {{ _location.address }}
                </p>
                <template #right>
                    <button type="button" class="button icon gray edit" @click.stop="doEditLocation(_location)" />
                </template>
            </STListItem>
            <STListItem element-name="label" :selectable="true" class="left-center">
                <template #left>
                    <Radio v-model="selectedLocation" :value="null" @change="changeSelected" />
                </template>
                Een andere locatie
            </STListItem>
        </STList>
        <p v-if="editingLocation" class="warning-box">
            Opgelet, alle tickets met deze locatie zullen worden gewijzigd. Kies 'Een andere locatie' als je een nieuwe locatie wilt invoeren.
        </p>
        <ProductLocationInput v-if="editingLocation || selectedLocation === null" v-model="editLocation" :validator="internalValidator" />
        <STErrorsDefault :error-box="errors.errorBox" />
    </div>
</template>

<script lang="ts" setup>
import { SimpleError } from '@simonbackx/simple-errors';
import { ErrorBox, Radio, STErrorsDefault, STList, STListItem, useErrors, useValidation, Validator } from '@stamhoofd/components';
import { I18nController } from '@stamhoofd/frontend-i18n';
import { Address, Country, ProductLocation } from '@stamhoofd/structures';

import { computed, onMounted, ref, watch } from 'vue';
import ProductLocationInput from './ProductLocationInput.vue';

const props = defineProps<{
    locations: ProductLocation[];
    // Assign a validator if you want to offload the validation to components
    validator: Validator | null;

}>();

const emits = defineEmits<{ (e: 'modify', value: { from: ProductLocation; to: ProductLocation }): void }>();
const errors = useErrors({ validator: props.validator });
useValidation(errors.validator, () => {
    return isValid();
});

const internalValidator = new Validator();

const model = defineModel<ProductLocation | null>({ default: null });

const selectedLocation = ref<ProductLocation | null>(null);
const customLocation = ref<ProductLocation | null>(null);
const editingLocation = ref(false);

watch(model, (val: ProductLocation | null) => {
    if (val === (selectedLocation.value ?? customLocation.value ?? null)) {
        // Not changed
        return;
    }

    if (!val) {
        return;
    }

    const a = props.locations.find(aa => aa.id === val.id);
    if (a) {
        selectedLocation.value = a;
        if (editingLocation.value) {
            customLocation.value = a;
        }
        else {
            customLocation.value = null;
        }
    }
    else {
        selectedLocation.value = null;
        editingLocation.value = false;
        customLocation.value = val;
    }
});

onMounted(() => {
    const a = props.locations.find(aa => aa.id === model.value?.id);
    if (a) {
        selectedLocation.value = a;
        editingLocation.value = false;
        customLocation.value = null;
    }
    else {
        selectedLocation.value = null;
        editingLocation.value = false;
        customLocation.value = model.value;

        if (!model.value) {
            if (props.locations.length > 0) {
                model.value = props.locations[0];
            }
            else {
                model.value = ProductLocation.create({
                    name: '',
                    address: Address.createDefault(I18nController.shared?.countryCode ?? Country.Belgium),
                });
            }
        }
    }
});

function changeSelected() {
    if (editingLocation.value) {
        customLocation.value = null;
    }
    editingLocation.value = false;

    let a = selectedLocation.value ?? customLocation.value;
    if (!a) {
        // Create a new custom one
        a = customLocation.value = ProductLocation.create({
            name: '',
            address: Address.createDefault(I18nController.shared?.countryCode ?? Country.Belgium),
        });
    }
    if (a) {
        model.value = a;
    }
}

function doEditLocation(location: ProductLocation) {
    model.value = location;
    editingLocation.value = true;
    selectedLocation.value = location;
    customLocation.value = location;
}

const editLocation = computed({
    get: () => customLocation.value,
    set: (location: ProductLocation | null) => {
        if (editingLocation.value && selectedLocation.value && location) {
            emits('modify', { from: selectedLocation.value, to: location });
            selectedLocation.value = location;
            model.value = location;
            editingLocation.value = true;
        }
        else {
            model.value = location;
        }
        customLocation.value = location;
    },
});

async function isValid(): Promise<boolean> {
    const isValid = await internalValidator.validate();
    if (!isValid) {
        errors.errorBox = null;
        return false;
    }

    if (selectedLocation.value) {
        model.value = selectedLocation.value;
        errors.errorBox = null;
        return true;
    }

    if (!customLocation.value) {
        errors.errorBox = new ErrorBox(new SimpleError({
            code: 'invalid_field',
            message: 'Vul een locatie in',
            field: 'location',
        }));
        return false;
    }

    errors.errorBox = null;
    model.value = customLocation.value;
    return true;
}
</script>
