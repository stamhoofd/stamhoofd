<template>
    <SaveView :title="title" :disabled="!hasChanges && !isNew" class="edit-seating-plan-view" :loading="saving" @save="save">
        <h1>
            {{ title }}
        </h1>
        <STErrorsDefault :error-box="errors.errorBox"/>

        <p v-if="$isMobile" class="warning-box">
            {{ $t('e76e8947-bc14-49eb-833c-724f9020dc7f') }}
        </p>

        <STInputBox error-fields="name" :error-box="errors.errorBox" :title="$t(`506757c1-1980-4fa1-ac0a-f0058eb2c369`)">
            <input ref="firstInput" v-model="name" class="input" type="text" :placeholder="$t(`802ec167-3d43-4cde-8c0d-e472f5b084c2`)" autocomplete="off" enterkeyhint="next"></STInputBox>

        <STList>
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="requireOptimalReservation"/>
                </template>

                <h3 class="style-title-list">
                    {{ $t('6023eb06-8b13-4bd4-9d1c-66f9a5399587') }}
                </h3>
                <p class="style-description-small">
                    {{ $t('afb774b8-c0f2-4c7d-bd19-ac855515f95a') }}
                </p>
            </STListItem>
        </STList>

        <hr><h2>{{ $t('b804501b-aaac-4b34-885d-aefa110876d2') }}</h2>
        <p>{{ $t('129ec81e-e594-43b5-b52f-474b3cd6e7e7') }}</p>
        <STList>
            <STListItem v-for="category in patchedSeatingPlan.categories" :key="category.id" :selectable="true" element-name="button" @click="editCategory(category)">
                <template #left>
                    <span class="icon dot gray custom-color" :style="{'--color': patchedSeatingPlan.getCategoryColor(category.id)}"/>
                </template>
                <h3 class="style-title-list">
                    {{ category.name }}
                </h3>
            </STListItem>
            <STListItem :selectable="true" element-name="button" @click="addCategory">
                <template #left>
                    <span class="icon add gray"/>
                </template>
                <h3 class="style-title-list">
                    {{ $t('799c9a22-4ca1-4ee3-8065-7baaa25d6d7c') }}
                </h3>
            </STListItem>
        </STList>

        <div v-for="section of patchedSeatingPlan.sections" :key="section.id" class="container">
            <hr><h2 v-if="patchedSeatingPlan.sections.length > 1" class="style-with-button">
                <div>{{ section.name||'Zone' }}</div>
                <div>
                    <button type="button" class="button icon trash" @click="deleteSection(section)"/>
                </div>
            </h2>

            <STInputBox v-if="patchedSeatingPlan.sections.length > 1" :error-box="errors.errorBox" :error-fields="'sections['+section.id+'].name'" :title="$t(`d32893b7-c9b0-4ea3-a311-90d29f2c0cf3`)">
                <input :value="section.name" class="input" type="text" :placeholder="$t(`f2f5f21e-896a-419c-978c-bc970f884860`)" autocomplete="off" enterkeyhint="next" @input="setSectionName(section, ($event as any).target.value)"></STInputBox>

            <EditSeatingPlanSectionBox :seating-plan="patchedSeatingPlan" :seating-plan-section="section" :validator="errors.validator" @patch="addPatch($event)"/>
        </div>

        <hr><p>
            <button class="button text" type="button" @click="addSection">
                <span class="icon add"/>
                <span>{{ $t('e7e4cd72-4925-4d35-9d9f-3e29c198c4fd') }}</span>
            </button>
        </p>

        <template v-if="!isNew">
            <hr><h2>{{ $t('8424a02d-2147-40d1-9db2-ddece074a650') }}</h2>

            <STList class="illustration-list">
                <STListItem :selectable="true" class="left-center" @click="downloadSettings">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/box-download.svg"></template>

                    <h2 class="style-title-list">
                        {{ $t('93abfaac-0987-4523-833b-b2023d2db8dc') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('d1287997-353a-4f9e-be61-37d9da434532') }}
                    </p>

                    <template #right>
                        <LoadingButton :loading="downloadingSettings">
                            <span class="icon download gray"/>
                        </LoadingButton>
                    </template>
                </STListItem>
            </STList>
        </template>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType, VersionBox } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, Checkbox, ErrorBox, LoadingButton, SaveView, STErrorsDefault, STInputBox, STList, STListItem, Toast, useErrors, usePatch } from '@stamhoofd/components';
import { PrivateWebshop, SeatingPlan, SeatingPlanCategory, SeatingPlanRow, SeatingPlanSection, Version, WebshopMetaData } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import { computed, ref } from 'vue';
import EditSeatingPlanCategoryView from './EditSeatingPlanCategoryView.vue';
import EditSeatingPlanSectionBox from './EditSeatingPlanSectionBox.vue';
import { AppManager } from '@stamhoofd/networking';

const props = defineProps<{
    isNew: boolean;
    seatingPlan: SeatingPlan;
    webshop: PrivateWebshop;
    // If we can immediately save this product, then you can create a save handler and pass along the changes.
    saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => void | Promise<void>;
}>();

const errors = useErrors();
const present = usePresent();
const pop = usePop();

const saving = ref(false);

const { patch: patchWebshop, addPatch: addWebshopPatch, hasChanges: hasWebshopChanges } = usePatch(props.webshop);
const { patch: patchSeatingPlan, patched: patchedSeatingPlan, addPatch, hasChanges: hasSeatingPlanChanges } = usePatch(props.seatingPlan);
const hasChanges = computed(() => hasWebshopChanges.value || hasSeatingPlanChanges.value);

const title = props.isNew ? 'Nieuwe zaalplan maken' : 'Zaalplan aanpassen';

const name = computed({
    get: () => patchedSeatingPlan.value.name,
    set: (value: string) => addPatch(SeatingPlan.patch({ name: value })),
});

const requireOptimalReservation = computed({
    get: () => patchedSeatingPlan.value.requireOptimalReservation,
    set: (value: boolean) => addPatch(SeatingPlan.patch({ requireOptimalReservation: value })),
});

function setSectionName(section: SeatingPlanSection, value: string) {
    const p = SeatingPlan.patch({});
    p.sections.addPatch(SeatingPlanSection.patch({ id: section.id, name: value }));
    addPatch(p);
}

async function save() {
    const isValid = await errors.validator.validate();
    if (!isValid) {
        return;
    }

    if (name.value.length < 2) {
        errors.errorBox = new ErrorBox(
            new SimpleError({
                code: 'invalid_field',
                message: 'De naam van de zaal moet minstens 2 karakters lang zijn',
                field: 'name',
            }),
        );
        return;
    }

    if (patchedSeatingPlan.value.sections.length > 1) {
        // Check unique names and non empty
        for (const section of patchedSeatingPlan.value.sections) {
            if (section.name.length < 1) {
                errors.errorBox = new ErrorBox(
                    new SimpleError({
                        code: 'invalid_field',
                        message: 'De naam van een zone mag niet leeg zijn',
                        field: 'sections[' + section.id + '].name',
                    }),
                );
                return;
            }
            if (patchedSeatingPlan.value.sections.filter(s => s.name === section.name).length > 1) {
                errors.errorBox = new ErrorBox(
                    new SimpleError({
                        code: 'invalid_field',
                        message: 'De naam van een zone moet uniek zijn',
                        field: 'sections[' + section.id + '].name',
                    }),
                );
                return;
            }
        }
    }

    saving.value = true;
    const meta = WebshopMetaData.patch({});
    meta.seatingPlans.addPatch(patchSeatingPlan.value);
    addWebshopPatch({ meta });

    try {
        await props.saveHandler(patchWebshop.value);
        pop({ force: true })?.catch(console.error);
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }

    saving.value = false;
}

function addSection() {
    const section = SeatingPlanSection.create({
        rows: [
            SeatingPlanRow.create({
                label: 'A',
            }),
        ],
    });
    const patch = SeatingPlan.patch({});
    patch.sections.addPut(section);
    addPatch(patch);
}

async function deleteSection(section: SeatingPlanSection) {
    if (!(await CenteredMessage.confirm('Ben je zeker dat je deze zone wilt verwijderen?', 'Verwijderen'))) {
        return;
    }

    const patch = SeatingPlan.patch({});
    patch.sections.addDelete(section.id);
    addPatch(patch);
}

async function shouldNavigateAway() {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm('Ben je zeker dat je wilt sluiten zonder op te slaan?', 'Niet opslaan');
}

const downloadingSettings = ref(false);

async function downloadSettings() {
    if (downloadingSettings.value) {
        return;
    }
    downloadingSettings.value = true;

    try {
        const versionBox = new VersionBox(patchedSeatingPlan.value);

        // Create a clean JSON file
        const string = JSON.stringify(versionBox.encode({ version: Version }), null, 2);

        // Create a blob
        const blob = new Blob([string], { type: 'application/json' });

        // Zip the file
        const JSZip = (await import(/* webpackChunkName: "jszip" */ 'jszip')).default;
        const zip = new JSZip();
        zip.file('plan.json', blob);
        const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
        await AppManager.shared.downloadFile(zipBlob, Formatter.fileSlug(patchedSeatingPlan.value.name) + '.plan');
    }
    catch (e) {
        console.error(e);
        new Toast('Er is iets misgelopen bij het downloaden van het zaalplan. Probeer om alles eerst op te slaan en daarna de pagina te herladen. Als het probleem zich blijft voordoen, neem dan contact met ons op.', 'error red');
    }
    finally {
        downloadingSettings.value = false;
    }
}

function addCategory() {
    // We choose a short id
    let id = patchedSeatingPlan.value.categories.length + 1;
    while (patchedSeatingPlan.value.categories.find(c => c.id === id.toString())) {
        id++;
    }
    const category = SeatingPlanCategory.create({
        id: id.toString(),
        name: 'Naamloos',
    });
    const patch = SeatingPlan.patch({});
    patch.categories.addPut(category);

    present({
        components: [
            new ComponentWithProperties(EditSeatingPlanCategoryView, {
                seatingPlan: patchedSeatingPlan.value.patch(patch),
                isNew: true,
                category,
                saveHandler: (p: AutoEncoderPatchType<SeatingPlan>) => {
                    addPatch(patch.patch(p));
                },
            }),
        ],
        modalDisplayStyle: 'sheet',
    }).catch(console.error);
}

function editCategory(category: SeatingPlanCategory) {
    present({
        components: [
            new ComponentWithProperties(EditSeatingPlanCategoryView, {
                seatingPlan: patchedSeatingPlan.value,
                isNew: false,
                category,
                saveHandler: (p: AutoEncoderPatchType<SeatingPlan>) => {
                    addPatch(p);
                },
            }),
        ],
        modalDisplayStyle: 'sheet',
    }).catch(console.error);
}

defineExpose({
    shouldNavigateAway,
});
</script>

<style lang="scss">
.edit-seating-plan-view {
    --st-popup-width: 1200px;
}
</style>
