<template>
    <div id="personalize-settings-view" class="st-view background">
        <STNavigationBar title="Werkjaar" :dismiss="canDismiss" :pop="canPop" />

        <main>
            <h1>
                Werkjaar
            </h1>

            <!-- todo: add other info? -->
            <!-- <p>Je kan later uitzonderingen voor bepaalde groepen toevoegen indien nodig.</p> -->

            <STErrorsDefault :error-box="errors.errorBox" />

            <div class="split-inputs">
                <STInputBox title="Inschrijven start op" error-fields="settings.startDate" :error-box="errors.errorBox">
                    <DateSelection v-model="startDate" />
                </STInputBox>
                <TimeInput v-model="startDate" title="Vanaf" :validator="errors.validator" />
            </div>

            <div class="split-inputs">
                <STInputBox title="Inschrijven sluit op" error-fields="settings.endDate" :error-box="errors.errorBox">
                    <DateSelection v-model="endDate" />
                </STInputBox>
                <TimeInput v-model="endDate" title="Tot welk tijdstip" :validator="errors.validator" />
            </div>
            <p class="style-description">
                Als de inschrijvingen het hele jaar doorlopen, vul dan hier gewoon een datum in ergens op het einde van het jaar. Let op het jaartal.
            </p>
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
import { ComponentWithProperties, useCanDismiss, useCanPop, useNavigationController, useShow } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, DateSelection, ErrorBox, LoadingButton, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, TimeInput, Toast, useErrors, usePatch, useRequiredOrganization } from '@stamhoofd/components';
import { useOrganizationManager } from '@stamhoofd/networking';
import { OrganizationMetaData } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import ActivatedView from './ActivatedView.vue';

const errors = useErrors();
const saving = ref(false);
const show = useShow();
const canDismiss = useCanDismiss();
const canPop = useCanPop();
const organizationManager = useOrganizationManager();
const navigationController = useNavigationController();

const requiredOrganization = useRequiredOrganization();
const { patch: organizationPatch, patched: patchedOrganization, hasChanges, addPatch: addOrganizationPatch, reset: resetOrganizationPatch } = usePatch(requiredOrganization.value);

const startDate = computed({
    get: () => patchedOrganization.value.meta.defaultStartDate,
    set: (defaultStartDate: Date) => {
        addMetaPatch({ defaultStartDate });
    },
});

const endDate = computed({
    get: () => patchedOrganization.value.meta.defaultEndDate,
    set: (defaultEndDate: Date) => {
        addMetaPatch({ defaultEndDate });
    },
});

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

        new Toast('Je kan nu de ledenadministratie uittesten', 'success green').show();

        show({
            components: [new ComponentWithProperties(ActivatedView)],
            replace: navigationController.value.components.length,
            force: true,
        }).catch(console.error);
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
