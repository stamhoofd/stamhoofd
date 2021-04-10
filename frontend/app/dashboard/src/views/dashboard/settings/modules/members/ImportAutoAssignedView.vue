<template>
    <div id="import-members-auto-assigned-view" class="st-view background">
        <STNavigationBar :title="title">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-else class="button icon close gray" slot="right" @click="pop" />
        </STNavigationBar>

        <main>
            <h1>{{ title }}</h1>
            <p>{{ description }}</p>

            <table class="data-table">
                <thead>
                    <tr>
                        <th>
                            Lid
                        </th>
                        <th>Groep</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(member, index) in members" :key="index">
                        <td>
                            {{ member.name }}
                        </td>
                        <td>
                            {{ member.group }}
                        </td>
                    </tr>
                </tbody>
</table>
</main>

        <STToolbar>
            <template slot="right">
                <button class="button secundary" @click="pop">
                    Sluiten
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, Decoder, PartialWithoutMethods, PatchableArray,PatchableArrayAutoEncoder,patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, HistoryManager,NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, CenteredMessage, Checkbox, ColorInput, DateSelection, ErrorBox, FileInput,IBANInput, ImageInput, LoadingButton, Radio, RadioGroup, STErrorsDefault,STInputBox, STNavigationBar, STToolbar, TimeInput, Toast, Validator} from "@stamhoofd/components";
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
export default class ImportAutoAssignedViewView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    title: string

    @Prop({ required: true })
    description: string
    
    @Prop({ required: true })
    members: { name: string; group: string}[]

}
</script>