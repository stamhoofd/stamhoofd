<template>
    <SaveView :title="title" :disabled="!hasChanges && !isNew" class="edit-seating-plan-view" :loading="saving" @save="save">
        <h1>
            {{ title }}
        </h1>
        <STErrorsDefault :error-box="errorBox" />

        <p v-if="$isMobile" class="warning-box">
            We raden aan om een zaalplan op te bouwen via een computer of tablet met toetsenbord.
        </p>

        <STInputBox title="Naam zaal" error-fields="name" :error-box="errorBox">
            <input
                ref="firstInput"
                v-model="name"
                class="input"
                type="text"
                :placeholder="'bv. Sportpaleis'"
                autocomplete=""
                enterkeyhint="next"
            >
        </STInputBox>

        <STList>
            <STListItem :selectable="true" element-name="label">
                <Checkbox #left v-model="requireOptimalReservation" />

                <h3 class="style-title-list">
                    Verplicht optimale zaalbezetting
                </h3>
                <p class="style-description-small">
                    Zorg dat het niet mogelijk is om maar één plaats tussen te laten.
                </p>
            </STListItem>
        </STList>

        <hr>
        <h2>Zetelcategorieën</h2>
        <p>Maak een zetelcategorie aan om een meerprijs in rekening te brengen voor sommige zetels of bepaalde zetels te reserveren. Selecteer daarna een rij of een zetel en klik op rechtermuisknop om de categorie van die rij of zetel te wijzigen.</p>
        <STList>
            <STListItem v-for="category in patchedSeatingPlan.categories" :key="category.id" :selectable="true" element-name="button" @click="editCategory(category)">
                <template #left><span class="icon dot gray custom-color" :style="{'--color': patchedSeatingPlan.getCategoryColor(category.id)}" /></template>
                <h3 class="style-title-list">
                    {{ category.name }}
                </h3>
            </STListItem>
            <STListItem :selectable="true" element-name="button" @click="addCategory">
                <template #left><span class="icon add gray" /></template>
                <h3 class="style-title-list">
                    Nieuwe categorie
                </h3>
            </STListItem>
        </STList>

        <div v-for="section of patchedSeatingPlan.sections" :key="section.id" class="container">
            <hr>

            <h2 v-if="patchedSeatingPlan.sections.length > 1" class="style-with-button">
                <div>{{ section.name||'Zone' }}</div>
                <div>
                    <button type="button" class="button icon trash" @click="deleteSection(section)" />
                </div>
            </h2>

            <STInputBox v-if="patchedSeatingPlan.sections.length > 1" title="Naam" :error-box="errorBox" :error-fields="'sections['+section.id+'].name'">
                <input
                    :value="section.name"
                    class="input"
                    type="text"
                    :placeholder="'bv. Middenplein'"
                    autocomplete=""
                    enterkeyhint="next"
                    @input="setSectionName(section, $event.target.value)"
                >
            </STInputBox>

            <EditSeatingPlanSectionBox 
                :seating-plan="patchedSeatingPlan"
                :seating-plan-section="section"
                :validator="validator"
                @patch="addPatch($event)"
            />
        </div>

        <hr>

        <p>
            <button class="button text" type="button" @click="addSection">
                <span class="icon add" />
                <span>Zone toevoegen</span>
            </button>
        </p>

        <template v-if="!isNew">
            <hr>

            <h2>Acties</h2>

            <STList class="illustration-list">    
                <STListItem :selectable="true" class="left-center" @click="downloadSettings(true)">
                    <template #left><img src="@stamhoofd/assets/images/illustrations/box-download.svg"></template>
                    <h2 class="style-title-list">
                        Exporteer zaalplan
                    </h2>
                    <p class="style-description">
                        Sla een kopie van jouw zaalplan op zodat je het kan delen met andere verenigingen.
                    </p>
                    <LoadingButton slot="right" :loading="downloadingSettings">
                        <span class="icon download gray" />
                    </LoadingButton>
                </STListItem>
            </STList>
        </template>
    </SaveView>
</template>

<script lang="ts">
import { AutoEncoderPatchType, patchContainsChanges, VersionBox } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox,ErrorBox, LoadingButton,Radio, SaveView, STErrorsDefault, STInputBox, STList, STListItem, Toast, Validator } from "@stamhoofd/components";
import { PrivateWebshop, SeatingPlan, SeatingPlanCategory, SeatingPlanRow, SeatingPlanSection, Version, WebshopMetaData } from "@stamhoofd/structures";
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";


import EditSeatingPlanCategoryView from './EditSeatingPlanCategoryView.vue';
import EditSeatingPlanSectionBox from './EditSeatingPlanSectionBox.vue';

@Component({
    components: {
        SaveView,
        STInputBox,
        STErrorsDefault,
        Radio,
        STList,
        STListItem,
        EditSeatingPlanSectionBox,
        LoadingButton,
        Checkbox
    },
})
export default class EditSeatingPlanView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false

    @Prop({ required: true })
        isNew!: boolean

    @Prop({ required: true })
        seatingPlan!: SeatingPlan

    @Prop({ required: true })
        webshop: PrivateWebshop

    /// For now only used to update locations and times of other products that are shared
    patchWebshop:  AutoEncoderPatchType<PrivateWebshop> = PrivateWebshop.patch({})
    patchSeatingPlan: AutoEncoderPatchType<SeatingPlan> = SeatingPlan.patch({ id: this.seatingPlan.id })

    /**
     * If we can immediately save this product, then you can create a save handler and pass along the changes.
     */
    @Prop({ required: true })
        saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => void | Promise<void>;

    get patchedWebshop() {
        return this.webshop.patch(this.patchWebshop)
    }

    get patchedSeatingPlan() {
        return this.seatingPlan.patch(this.patchSeatingPlan)
    }

    get organization() {
        return this.$organization
    }

    get title() {
        if (this.isNew) {
            return 'Nieuw zaalplan maken'
        }
        return 'Zaalplan aanpassen'
    }

    addPatch(patch: AutoEncoderPatchType<SeatingPlan>) {
        this.patchSeatingPlan = this.patchSeatingPlan.patch(patch)
    }

    get name() {
        return this.patchedSeatingPlan.name
    }

    set name(value: string) {
        this.addPatch(SeatingPlan.patch({ name: value }));
    }

    get requireOptimalReservation() {
        return this.patchedSeatingPlan.requireOptimalReservation
    }

    set requireOptimalReservation(value: boolean) {
        this.addPatch(SeatingPlan.patch({ requireOptimalReservation: value }));
    }

    setSectionName(section: SeatingPlanSection, value: string) {
        const p = SeatingPlan.patch({});
        p.sections.addPatch(SeatingPlanSection.patch({ id: section.id, name: value }))
        this.addPatch(p)
    }

    async save() {
        const isValid = await this.validator.validate()
        if (!isValid) {
            return
        }

        if (this.name.length < 2) {
            this.errorBox = new ErrorBox(
                new SimpleError({
                    code: 'invalid_field',
                    message: 'De naam van de zaal moet minstens 2 karakters lang zijn',
                    field: 'name',
                })
            );
            return
        }

        if (this.patchedSeatingPlan.sections.length > 1) {
            // Check unique names and non empty
            for (const section of this.patchedSeatingPlan.sections) {
                if (section.name.length < 1) {
                    this.errorBox = new ErrorBox(
                        new SimpleError({
                            code: 'invalid_field',
                            message: 'De naam van een zone mag niet leeg zijn',
                            field: 'sections['+section.id+'].name',
                        })
                    );
                    return
                }
                if (this.patchedSeatingPlan.sections.filter(s => s.name === section.name).length > 1) {
                    this.errorBox = new ErrorBox(
                        new SimpleError({
                            code: 'invalid_field',
                            message: 'De naam van een zone moet uniek zijn',
                            field: 'sections['+section.id+'].name',
                        })
                    );
                    return
                }
            }
        }

        this.saving = true;

        const p = PrivateWebshop.patch(this.patchWebshop)
        const meta = WebshopMetaData.patch({})
        meta.seatingPlans.addPatch(this.patchSeatingPlan)
        const patchedWebshop = p.patch({meta})

        try {
            await this.saveHandler(patchedWebshop)
            this.pop({ force: true })
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }

        this.saving = false;
    }

    get hasChanges() {
        return patchContainsChanges(this.patchSeatingPlan, this.seatingPlan, { version: Version }) || patchContainsChanges(this.patchWebshop, this.webshop, { version: Version })
    }

    addSection() {
        const section = SeatingPlanSection.create({
            rows: [
                SeatingPlanRow.create({
                    label: 'A'
                })
            ]
        })
        const patch = SeatingPlan.patch({})
        patch.sections.addPut(section)
        this.addPatch(patch)
    }

    async deleteSection(section: SeatingPlanSection) {
        if (!(await CenteredMessage.confirm("Ben je zeker dat je deze zone wilt verwijderen?", "Verwijderen"))) {
            return;
        }

        const patch = SeatingPlan.patch({})
        patch.sections.addDelete(section.id)
        this.addPatch(patch)
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    downloadingSettings = false

    async downloadSettings() {
        if (this.downloadingSettings) {
            return
        }
        this.downloadingSettings = true

        try {
            const versionBox = new VersionBox(this.patchedSeatingPlan)
            
            // Create a clean JSON file
            const string = JSON.stringify(versionBox.encode({version: Version}), null, 2);

            // Create a blob
            const blob = new Blob([string], { type: 'application/json' });

            // Zip the file
            const JSZip = (await import(/* webpackChunkName: "jszip" */ 'jszip')).default;
            const saveAs = (await import(/* webpackChunkName: "file-saver" */ 'file-saver')).default.saveAs;
            const zip = new JSZip();
            zip.file('plan.json', blob);
            const zipBlob = await zip.generateAsync({type:"blob", compression: "DEFLATE", compressionOptions : {level:6}})
            saveAs(zipBlob, Formatter.fileSlug(this.patchedSeatingPlan.name)+ '.plan');
        } catch (e) {
            console.error(e)
            new Toast('Er is iets misgelopen bij het downloaden van het zaalplan. Probeer om alles eerst op te slaan en daarna de pagina te herladen. Als het probleem zich blijft voordoen, neem dan contact met ons op.', 'error red')
        } finally {
            this.downloadingSettings = false
        }
    }

    addCategory() {
        // We choose a short id
        let id = this.patchedSeatingPlan.categories.length + 1
        while (this.patchedSeatingPlan.categories.find(c => c.id === id.toString())) {
            id++
        }
        const category = SeatingPlanCategory.create({
            id: id.toString(),
            name: 'Naamloos'
        })
        const patch = SeatingPlan.patch({})
        patch.categories.addPut(category)
        
        this.present({
            components: [
                new ComponentWithProperties(EditSeatingPlanCategoryView, {
                    seatingPlan: this.patchedSeatingPlan.patch(patch),
                    isNew: true,
                    category,
                    saveHandler: (p: AutoEncoderPatchType<SeatingPlan>) => {
                        this.addPatch(patch.patch(p))
                    }
                })
            ],
            modalDisplayStyle: 'sheet'
        })
    }

    editCategory(category: SeatingPlanCategory) {
        this.present({
            components: [
                new ComponentWithProperties(EditSeatingPlanCategoryView, {
                    seatingPlan: this.patchedSeatingPlan,
                    isNew: false,
                    category,
                    saveHandler: (p: AutoEncoderPatchType<SeatingPlan>) => {
                        this.addPatch(p)
                    }
                })
            ],
            modalDisplayStyle: 'sheet'
        })
    }
    
}
</script>

<style lang="scss">
.edit-seating-plan-view {
    --st-popup-width: 1200px;
}
</style>