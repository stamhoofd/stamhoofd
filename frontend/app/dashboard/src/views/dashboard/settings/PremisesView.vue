<template>
    <SaveView :loading="saving" title="Gebouwen" :disabled="!hasChanges" @save="save">
        <h1>
            Gebouwen
        </h1>
        
        <STErrorsDefault :error-box="errorBox" />

        <template v-if="!draggablePremises.length">
            <p class="info-box">Er zijn nog geen gebouwen.</p>
        </template>

        <STList v-model="draggablePremises" :draggable="true">
            <template #item="{item: premise}">
                <PremiseRow :premise="premise" @click="editPremise(premise)" />
            </template>
        </STList>

        <p>
            <button class="button text" type="button" @click="addPremise">
                <span class="icon add" />
                <span>{{ $t('Nieuw gebouw') }}</span>
            </button>
        </p>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ErrorBox, STErrorsDefault, SaveView, Toast, useCountry, useDraggableArray, useErrors, usePatchArray } from "@stamhoofd/components";
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { useOrganizationManager } from '@stamhoofd/networking';
import { Organization, OrganizationPrivateMetaData, Premise } from "@stamhoofd/structures";
import { computed, ref } from 'vue';
import PremiseRow from './PremiseRow.vue';
import PremiseView from './PremiseView.vue';

const errorBox: ErrorBox | null = null
const errors = useErrors();
const saving = ref(false);

const $organizationManager = useOrganizationManager();
const pop = usePop();
const originalPremises = computed(() => $organizationManager.value.organization.privateMeta?.premises ?? []);
const {patched: premises, patch, addArrayPatch, hasChanges} = usePatchArray(originalPremises)
const draggablePremises = useDraggableArray(() => premises.value, addArrayPatch)
const $t = useTranslate();
const present = usePresent();
const country = useCountry();
    
async function addPremise() {
    const arr: PatchableArrayAutoEncoder<Premise> = new PatchableArray();

    const premise = Premise.createDefault(country.value);

    arr.addPut(premise)

    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(PremiseView, {
                premise,
                isNew: true,
                saveHandler: (patch: AutoEncoderPatchType<Premise>) => {
                    patch.id = premise.id
                    arr.addPatch(patch)
                    addArrayPatch(arr)
                }
            })
        ]
    })
}

async function editPremise(premise: Premise) {
    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(PremiseView, {
                premise,
                isNew: false,
                saveHandler: (patch: AutoEncoderPatchType<Premise>) => {
                    const arr: PatchableArrayAutoEncoder<Premise> = new PatchableArray()
                    arr.addPatch(patch)
                    addArrayPatch(arr)
                },
                deleteHandler: () => {
                    const arr: PatchableArrayAutoEncoder<Premise> = new PatchableArray()
                    arr.addDelete(premise.id)
                    addArrayPatch(arr)
                }
            })
        ]
    })
}

async function save() {
    if (saving.value) {
        return;
    }

    saving.value = true;

    try {
        await $organizationManager.value.patch(Organization.patch({
            privateMeta: OrganizationPrivateMetaData.patch({
                premises: patch.value as any
            })
        }));
        new Toast('De wijzigingen zijn opgeslagen', "success green").show()
        await pop({ force: true });
    } catch (e) {
        errors.errorBox = new ErrorBox(e)
    }

    saving.value = false;
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('Ben je zeker dat je wilt sluiten zonder op te slaan?'), $t('Niet opslaan'))
}

defineExpose({
    shouldNavigateAway
})
</script>
