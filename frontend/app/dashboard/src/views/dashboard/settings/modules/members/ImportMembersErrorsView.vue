<template>
    <div id="import-members-errors-view" class="st-view background">
        <STNavigationBar title="Kijk deze fouten na">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-else class="button icon close gray" @click="pop" slot="right" />
        </STNavigationBar>

        <main>
            <h1>Kijk deze fouten na</h1>
            <p>In sommige rijen hebben we gegevens gevonden die we niet 100% goed konden intepreteren. Kijk hieronder na waar je nog wijzigingen moet aanbrengen en pas het aan in jouw bestand.</p>

            <table class="data-table">
                <thead>
                    <tr>
                        <th>
                            Fout
                        </th>
                        <th>Cel</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(error, index) in errors" :key="index">
                        <td>
                            {{ error.message }}
                        </td>
                        <td>
                            {{ error.cellPath }}
                        </td>
                    </tr>
                </tbody>

            </table>

            
            <STErrorsDefault :error-box="errorBox" />
        </main>

        <STToolbar>
            <template slot="right">
                <LoadingButton :loading="saving">
                    <button class="button primary" @click="pop">
                        Nieuw bestand uploaden
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, Decoder, PartialWithoutMethods, PatchableArray,PatchableArrayAutoEncoder,patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, HistoryManager,NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { TimeInput, BackButton, CenteredMessage, Checkbox, ColorInput, DateSelection, ErrorBox, FileInput,IBANInput, ImageInput, LoadingButton, Radio, RadioGroup, STErrorsDefault,STInputBox, STNavigationBar, STToolbar, Toast, Validator} from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { Address, File, GroupPrices, Image, Organization, OrganizationMetaData, OrganizationModules, OrganizationPatch, OrganizationPrivateMetaData,PaymentMethod, ResolutionFit, ResolutionRequest, Version } from "@stamhoofd/structures"
import { Component, Mixins, Prop } from "vue-property-decorator";
import { ImportError, ImportingMember } from '../../../../../classes/import/ImportingMember';

import { OrganizationManager } from "../../../../../classes/OrganizationManager"

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        RadioGroup,
        Radio,
        STErrorsDefault,
        Checkbox,
        BackButton,
        LoadingButton
    },
})
export default class ImportMembersErrorsView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false
    organizationPatch: AutoEncoderPatchType<Organization> & AutoEncoder = OrganizationPatch.create({ id: OrganizationManager.organization.id })

    @Prop({ required: true })
    errors: ImportError[]

    get organization() {
        return OrganizationManager.organization.patch(this.organizationPatch)
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;
</style>
