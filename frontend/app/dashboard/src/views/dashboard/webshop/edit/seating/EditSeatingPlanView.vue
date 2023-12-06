<template>
    <SaveView :title="title" :disabled="!hasChanges" class="edit-seating-plan-view" @save="save">
        <h1>
            {{ title }}
        </h1>
        <STErrorsDefault :error-box="errorBox" />

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

        <div v-for="section of patchedSeatingPlan.sections" :key="section.id" class="container">
            <hr>
            <h2>{{ section.name || 'Sectie' }}</h2>
            <EditSeatingPlanSectionBox 
                :seating-plan="patchedSeatingPlan"
                :seating-plan-section="section"
                @patch="addPatch($event)"
            />
        </div>

        <hr>

        <p>
            <button class="button text" type="button" @click="addSection">
                <span class="icon add" />
                <span>Sectie toevoegen</span>
            </button>
        </p>

        <hr>

        <h2>Acties</h2>

        <STList class="illustration-list">    
            <STListItem :selectable="true" class="left-center" @click="downloadSettings(true)">
                <img slot="left" src="~@stamhoofd/assets/images/illustrations/box-download.svg">
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
    </SaveView>
</template>

<script lang="ts">
import { AutoEncoderPatchType, patchContainsChanges, VersionBox } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ErrorBox, LoadingButton,Radio, SaveView, STErrorsDefault, STInputBox, STList, STListItem, Toast, Validator } from "@stamhoofd/components";
import { PrivateWebshop, SeatingPlan, SeatingPlanSection, Version, WebshopMetaData } from "@stamhoofd/structures";
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { OrganizationManager } from '../../../../../classes/OrganizationManager';
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
        LoadingButton
    },
})
export default class EditSeatingPlanView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()

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
        saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => void;

    get patchedWebshop() {
        return this.webshop.patch(this.patchWebshop)
    }

    get patchedSeatingPlan() {
        return this.seatingPlan.patch(this.patchSeatingPlan)
    }

    get organization() {
        return OrganizationManager.organization
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

        const p = PrivateWebshop.patch(this.patchWebshop)
        const meta = WebshopMetaData.patch({})
        meta.seatingPlans.addPatch(this.patchSeatingPlan)
        const patchedWebshop = p.patch({meta})
        this.saveHandler(patchedWebshop)
        this.pop({ force: true })
    }

    get hasChanges() {
        return patchContainsChanges(this.patchSeatingPlan, this.seatingPlan, { version: Version }) || patchContainsChanges(this.patchWebshop, this.webshop, { version: Version })
    }

    addSection() {
        const section = SeatingPlanSection.create({})
        const patch = SeatingPlan.patch({})
        patch.sections.addPut(section)
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

            // TODO: include json with type information

            const zipBlob = await zip.generateAsync({type:"blob"})
            saveAs(zipBlob, Formatter.fileSlug(this.patchedSeatingPlan.name)+ '.plan');
        } catch (e) {
            console.error(e)
            new Toast('Er is iets misgelopen bij het downloaden van het zaalplan. Probeer om alles eerst op te slaan en daarna de pagina te herladen. Als het probleem zich blijft voordoen, neem dan contact met ons op.', 'error red')
        } finally {
            this.downloadingSettings = false
        }
    }
    
}
</script>

<style lang="scss">
.edit-seating-plan-view {
    --st-popup-width: 1200px;
}
</style>