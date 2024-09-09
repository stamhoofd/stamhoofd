<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasSomeChanges" @save="save">
        <h1>
            {{ title }}
        </h1>
        <p class="style-description-block">
            {{ isReview ? 'Kijk alle lokalen na. Klik op een lokaal om deze te bewerken. De lokalen die je hier registreert zijn verzekerd via de brandpolis van KSA' : 'De lokalen die je hier registreert zijn verzekerd via de brandpolis van KSA' }}
        </p>

        <div v-if="isReview" class="container">
            <ReviewCheckbox :data="$reviewCheckboxData" />
            <hr>
        </div>
        
        <STErrorsDefault :error-box="errorBox" />

        <p v-for="warning of premiseLimitationWarnings" :key="warning.id" class="warning-box">{{ warning.message }}</p>

        <template v-if="!draggablePremises.length">
            <p class="info-box">Er zijn nog geen lokalen toegevoegd</p>
        </template>

        <STList v-model="draggablePremises" :draggable="true">
            <template #item="{item: premise}">
                <PremiseRow :premise="premise" @click="editPremise(premise)" />
            </template>
        </STList>

        <p>
            <button class="button text" type="button" @click="addPremise">
                <span class="icon add" />
                <span>{{ $t('5e40dfe9-b4ed-497c-a37d-e162191ba96a') }}</span>
            </button>
        </p>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ErrorBox, ReviewCheckbox, STErrorsDefault, SaveView, Toast, useCountry, useDraggableArray, useErrors, usePatchArray, usePlatform, useReview } from "@stamhoofd/components";
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { useOrganizationManager } from '@stamhoofd/networking';
import { Organization, OrganizationPrivateMetaData, PlatformPremiseType, Premise, SetupStepType } from "@stamhoofd/structures";
import { computed, ref } from 'vue';
import PremiseRow from './PremiseRow.vue';
import PremiseView from './PremiseView.vue';

type PremiseLimitationWarning = {id: string, message: string}

const props = defineProps<{isReview?: boolean}>();
const errorBox: ErrorBox | null = null
const errors = useErrors();
const saving = ref(false);

const platform$ = usePlatform();
const organizationManager$ = useOrganizationManager();
const { $reviewCheckboxData, $hasChanges: $hasReviewChanges, $overrideIsDone, save: saveReview } = useReview(SetupStepType.Premises);
const pop = usePop();
const originalPremises = computed(() => organizationManager$.value.organization.privateMeta?.premises ?? []);
const {patched: premises, patch, addArrayPatch, hasChanges} = usePatchArray(originalPremises);

const title = 'Lokalen';
const hasSomeChanges = computed(() => {
    if(props.isReview) {
        return hasChanges.value || $hasReviewChanges.value;
    }
    return hasChanges.value;
});

const draggablePremises = useDraggableArray(() => premises.value, addArrayPatch)
const $t = useTranslate();
const present = usePresent();
const country = useCountry();
const premiseLimitationWarnings = ref<PremiseLimitationWarning[]>([]);
let premiseTypeCount: Map<string, {type: PlatformPremiseType, count: number}> = new Map(); 
    
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
                premiseTypeCount,
                saveHandler: (patch: AutoEncoderPatchType<Premise>) => {
                    patch.id = premise.id
                    arr.addPatch(patch)
                    addArrayPatch(arr)
                    updatePremiseLimitationWarnings();
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
                premiseTypeCount,
                saveHandler: (patch: AutoEncoderPatchType<Premise>) => {
                    const arr: PatchableArrayAutoEncoder<Premise> = new PatchableArray()
                    arr.addPatch(patch)
                    addArrayPatch(arr);
                    updatePremiseLimitationWarnings();
                },
                deleteHandler: () => {
                    const arr: PatchableArrayAutoEncoder<Premise> = new PatchableArray()
                    arr.addDelete(premise.id)
                    addArrayPatch(arr);
                    updatePremiseLimitationWarnings();
                }
            })
        ]
    })
}

function updatePremiseLimitationWarnings() {
    premiseTypeCount = new Map(platform$.value.config.premiseTypes.map(type => [type.id, {type, count: 0}]));

    const allPremiseTypesIds = premises.value.flatMap(premise => premise.premiseTypeIds) ?? [];
    
    for(const premiseTypeId of allPremiseTypesIds) {
        const typeCount = premiseTypeCount.get(premiseTypeId);
        if(typeCount) {
            typeCount.count = typeCount.count + 1;
        }
    }

    const warnings: PremiseLimitationWarning[] = [];

    for(const {type, count} of premiseTypeCount.values()) {
        const {min, max, name, id} = type;

        if(max !== null && count > max) {
            const countDiff = count - max;
            const message = `Verwijder ${countDiff} ${countDiff === 1 ? 'lokaal' : 'lokalen'} van soort "${name}".`;
            warnings.push({id, message});
        } else if(min !== null && count < min) {
            const countDiff = min - count;
            const message = `Voeg ${countDiff} ${countDiff === 1 ? 'lokaal' : 'lokalen'} van soort "${name}" toe.`;
            warnings.push({id, message});
        }
    }

    premiseLimitationWarnings.value = warnings;
    $overrideIsDone.value = warnings.length === 0;
}

async function save() {
    if (saving.value) {
        return;
    }

    saving.value = true;

    try {
        if (hasChanges.value) {
            await organizationManager$.value.patch(Organization.patch({
                privateMeta: OrganizationPrivateMetaData.patch({
                    premises: patch.value as any
                })
            }));
        }

        if ($hasReviewChanges.value) {
            await saveReview();
        }

        new Toast('De wijzigingen zijn opgeslagen', "success green").show()
        await pop({ force: true });
    } catch (e) {
        errors.errorBox = new ErrorBox(e)
    }

    saving.value = false;
}

const shouldNavigateAway = async () => {
    if (!hasSomeChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('996a4109-5524-4679-8d17-6968282a2a75'), $t('106b3169-6336-48b8-8544-4512d42c4fd6'))
}

defineExpose({
    shouldNavigateAway
});

updatePremiseLimitationWarnings();
</script>
