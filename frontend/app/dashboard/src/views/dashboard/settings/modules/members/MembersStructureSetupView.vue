<template>
    <div class="st-view background">
        <STNavigationBar title="Samenstelling" :dismiss="canDismiss" :pop="canPop" />

        <main>
            <h1>
                Configureer leeftijdsgroepen
            </h1>
            <p>Aan de hand van jouw antwoorden kunnen we de meeste instellingen automatisch configureren. Je kan dit hierna nog nauwkeuriger instellen.</p>

            <STErrorsDefault :error-box="errors.errorBox" />

            <div class="split-inputs">
                <STInputBox title="Soort vereniging" error-fields="type" :error-box="errors.errorBox">
                    <Dropdown v-model="type">
                        <option :value="null" disabled>
                            Maak een keuze
                        </option>
                        <option v-for="_type in availableTypes" :key="_type.value" :value="_type.value">
                            {{ _type.name }}
                        </option>
                    </Dropdown>
                </STInputBox>

                <STInputBox v-if="type == 'Youth'" title="Koepelorganisatie" error-fields="umbrellaOrganization" :error-box="errors.errorBox">
                    <Dropdown v-model="umbrellaOrganization">
                        <option :value="null" disabled>
                            Maak een keuze
                        </option>
                        <option v-for="item in availableUmbrellaOrganizations" :key="item.value" :value="item.value">
                            {{ item.name }}
                        </option>
                    </Dropdown>
                </STInputBox>
            </div>

            <STInputBox title="Jongens en meisjes" error-fields="genderType" :error-box="errors.errorBox" class="max">
                <RadioGroup>
                    <Radio v-for="_genderType in genderTypes" :key="_genderType.value" v-model="genderType" :value="_genderType.value">
                        {{ _genderType.name }}
                    </Radio>
                </RadioGroup>
            </STInputBox>
        </main>

        <STToolbar>
            <template #right>
                <LoadingButton :loading="saving">
                    <button class="button primary" type="button" @click="save">
                        Volgende
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType, PartialWithoutMethods } from '@simonbackx/simple-encoding';
import { SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, useCanDismiss, useCanPop, useShow } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, Dropdown, ErrorBox, LoadingButton, Radio, RadioGroup, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, useErrors, usePatch, useRequiredOrganization } from '@stamhoofd/components';
import { OrganizationGenderType, OrganizationMetaData, OrganizationType, OrganizationTypeHelper, UmbrellaOrganization, UmbrellaOrganizationHelper } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';

import { useOrganizationManager } from '@stamhoofd/networking';
import { computed, ref } from 'vue';
import MembersYearSetupView from './MembersYearSetupView.vue';

const errors = useErrors();
const saving = ref(false);
const show = useShow();
const canDismiss = useCanDismiss();
const canPop = useCanPop();
const organizationManager = useOrganizationManager();

const requiredOrganization = useRequiredOrganization();
const { patch: organizationPatch, patched: patchedOrganization, hasChanges, addPatch: addOrganizationPatch, reset: resetOrganizationPatch } = usePatch(requiredOrganization.value);

const type = computed({
    get: () => patchedOrganization.value.meta.type,
    set: (type: OrganizationType) => {
        addMetaPatch({ type });
    },

});

const umbrellaOrganization = computed({
    get: () => patchedOrganization.value.meta.umbrellaOrganization,
    set: (umbrellaOrganization: UmbrellaOrganization | null) => {
        addMetaPatch({ umbrellaOrganization });
    },
});

const genderType = computed({
    get: () => patchedOrganization.value.meta.genderType,
    set: (genderType: OrganizationGenderType) => {
        addMetaPatch({ genderType });
    },
});

const genderTypes = [
    {
        value: OrganizationGenderType.Mixed,
        name: 'Gemengd',
    },
    {
        value: OrganizationGenderType.Separated,
        name: 'Gescheiden',
    },
    {
        value: OrganizationGenderType.OnlyFemale,
        name: 'Enkel meisjes',
    },
    {
        value: OrganizationGenderType.OnlyMale,
        name: 'Enkel jongens',
    },
];

const availableTypes = OrganizationTypeHelper.getList().sort((a, b) =>
    Sorter.stack(
        Sorter.byBooleanValue(
            !a.name.toLowerCase().startsWith('andere'),
            !b.name.toLowerCase().startsWith('andere'),
        ),
        Sorter.byStringProperty(a, b, 'name'),
    ));

const availableUmbrellaOrganizations
        = UmbrellaOrganizationHelper.getList().sort((a, b) =>
            Sorter.stack(
                Sorter.byBooleanValue(
                    !a.name.toLowerCase().startsWith('andere'),
                    !b.name.toLowerCase().startsWith('andere'),
                ),
                Sorter.byStringProperty(a, b, 'name'),
            ),
        );

function addMetaPatch(patch: PartialWithoutMethods<AutoEncoderPatchType<OrganizationMetaData>>) {
    addOrganizationPatch({ meta: OrganizationMetaData.patch(patch) });
}

async function save() {
    if (saving.value) {
        return;
    }

    const simpleErrors = new SimpleErrors();

    let valid = false;

    if (simpleErrors.errors.length > 0) {
        errors.errorBox = new ErrorBox(errors);
    }
    else {
        errors.errorBox = null;
        valid = true;
    }
    valid = valid && await errors.validator.validate();

    if (!valid) {
        return;
    }

    saving.value = true;

    try {
        await organizationManager.value.patch(organizationPatch.value);
        // todo: test is this necesary?
        resetOrganizationPatch();
        show(new ComponentWithProperties(MembersYearSetupView, {})).catch(console.error);
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }

    saving.value = false;
}

async function shouldNavigateAway() {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm('Ben je zeker dat je wilt sluiten zonder op te slaan?', 'Niet opslaan');
}

defineExpose({
    shouldNavigateAway,
});
</script>
