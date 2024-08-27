<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasSomeChanges" @save="save">
        <h1>
            {{ title }}
        </h1>
        <p class="style-description-block">
            {{ isReview ? 'Kijk alle gebouwen na. Klik op een gebouw om deze te bewerken.' : 'Hier kan je een overzicht van de gebouwen van de groep bijhouden.' }}
        </p>

        <div v-if="isReview" class="container">
            <ReviewCheckbox :data="review" />
            <hr>
        </div>
        
        <STErrorsDefault :error-box="errorBox" />

        <p v-for="warning of premiseLimitationWarnings" :key="warning.id" class="warning-box">{{ warning.message }}</p>

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
const review = useReview(SetupStepType.Premises);
const pop = usePop();
const originalPremises = computed(() => organizationManager$.value.organization.privateMeta?.premises ?? []);
const {patched: premises, patch, addArrayPatch, hasChanges} = usePatchArray(originalPremises);

const title = 'Gebouwen';
const hasSomeChanges = computed(() => {
    if(props.isReview) {
        return hasChanges.value || review.hasChanges.value;
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
            const message = `Verwijder ${countDiff} ${countDiff === 1 ? 'gebouw' : 'gebouwen'} van soort "${name}".`;
            warnings.push({id, message});
        } else if(min !== null && count < min) {
            const countDiff = min - count;
            const message = `Voeg ${countDiff} ${countDiff === 1 ? 'gebouw' : 'gebouwen'} van soort "${name}" toe.`;
            warnings.push({id, message});
        }
    }

    premiseLimitationWarnings.value = warnings;
    review.overrideIsDone.value = warnings.length === 0;
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

        if (review.hasChanges.value) {
            await review.save();
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
    return await CenteredMessage.confirm($t('Ben je zeker dat je wilt sluiten zonder op te slaan?'), $t('Niet opslaan'))
}

defineExpose({
    shouldNavigateAway
});

updatePremiseLimitationWarnings();
</script>
