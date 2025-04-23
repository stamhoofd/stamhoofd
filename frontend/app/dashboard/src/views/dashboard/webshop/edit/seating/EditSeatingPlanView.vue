<template>
    <SaveView :title="title" :disabled="!hasChanges && !isNew" class="edit-seating-plan-view" :loading="saving" @save="save">
        <h1>
            {{ title }}
        </h1>
        <STErrorsDefault :error-box="errors.errorBox" />

        <p v-if="$isMobile" class="warning-box">
            {{ $t('c2a80b2c-ee46-4ad4-874c-e7c55b8bf1ea') }}
        </p>

        <STInputBox error-fields="name" :error-box="errors.errorBox" :title="$t(`5679e683-857d-4d15-8945-6f7e83b29ed6`)">
            <input ref="firstInput" v-model="name" class="input" type="text" :placeholder="$t(`de283a30-530c-432d-a0dd-b7b779c8e2ae`)" autocomplete="off" enterkeyhint="next">
        </STInputBox>

        <STList>
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="requireOptimalReservation" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('07c62d80-a20a-40dd-a256-cb96114a0747') }}
                </h3>
                <p class="style-description-small">
                    {{ $t('159724b0-4a18-4dcc-8ca5-93f690ea7276') }}
                </p>
            </STListItem>
        </STList>

        <hr><h2>{{ $t('033ff0c0-aad1-4982-9103-fa0af111b844') }}</h2>
        <p>{{ $t('704593e1-dcb5-459e-b346-47ea2647da52') }}</p>
        <STList>
            <STListItem v-for="category in patchedSeatingPlan.categories" :key="category.id" :selectable="true" element-name="button" @click="editCategory(category)">
                <template #left>
                    <span class="icon dot gray custom-color" :style="{'--color': patchedSeatingPlan.getCategoryColor(category.id)}" />
                </template>
                <h3 class="style-title-list">
                    {{ category.name }}
                </h3>
            </STListItem>
            <STListItem :selectable="true" element-name="button" @click="addCategory">
                <template #left>
                    <span class="icon add gray" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('97ddbaef-0a49-4b53-893d-4c77dad6f52b') }}
                </h3>
            </STListItem>
        </STList>

        <div v-for="section of patchedSeatingPlan.sections" :key="section.id" class="container">
            <hr><h2 v-if="patchedSeatingPlan.sections.length > 1" class="style-with-button">
                <div>{{ section.name||'Zone' }}</div>
                <div>
                    <button type="button" class="button icon trash" @click="deleteSection(section)" />
                </div>
            </h2>

            <STInputBox v-if="patchedSeatingPlan.sections.length > 1" :error-box="errors.errorBox" :error-fields="'sections['+section.id+'].name'" :title="$t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`)">
                <input :value="section.name" class="input" type="text" :placeholder="$t(`81eb8b52-1db5-450c-a7de-fbc5fd0cfc00`)" autocomplete="off" enterkeyhint="next" @input="setSectionName(section, ($event as any).target.value)">
            </STInputBox>

            <EditSeatingPlanSectionBox :seating-plan="patchedSeatingPlan" :seating-plan-section="section" :validator="errors.validator" @patch="addPatch($event)" />
        </div>

        <hr><p>
            <button class="button text" type="button" @click="addSection">
                <span class="icon add" />
                <span>{{ $t('3946d93e-f7ed-4dd9-9176-171e133d3558') }}</span>
            </button>
        </p>

        <template v-if="!isNew">
            <hr><h2>{{ $t('dc052084-eea5-407e-8775-237bf550895a') }}</h2>

            <STList class="illustration-list">
                <STListItem :selectable="true" class="left-center" @click="downloadSettings">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/box-download.svg">
                    </template>

                    <h2 class="style-title-list">
                        {{ $t('5c031764-a911-4861-b09e-621058dcf6d4') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('02f2c884-7524-4c41-90c9-746a074185aa') }}
                    </p>

                    <template #right>
                        <LoadingButton :loading="downloadingSettings">
                            <span class="icon download gray" />
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

import { AppManager } from '@stamhoofd/networking';
import { computed, ref } from 'vue';
import EditSeatingPlanCategoryView from './EditSeatingPlanCategoryView.vue';
import EditSeatingPlanSectionBox from './EditSeatingPlanSectionBox.vue';

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
