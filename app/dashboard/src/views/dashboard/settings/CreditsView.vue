<template>
    <div class="st-view background" id="credits-view">
        <STNavigationBar title="Gratis en open-source">
            <BackButton slot="left" v-if="canPop" @click="pop"/>
        </STNavigationBar>

        <main>
            <h1>
                Stamhoofd is nu volledig gratis en open-source
            </h1>
            <p>Alles wat je kent blijft, maar je hoeft niets meer te betalen om het te gebruiken. Zin om mee te bouwen aan Stamhoofd? Open dan zeker een issue of pull request in onze Github repositories.</p>
        </main>
    </div>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, Decoder,PartialWithoutMethods, PatchType, patchContainsChanges } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin, NavigationController } from "@simonbackx/vue-app-navigation";
import { ErrorBox, BackButton, STErrorsDefault,STInputBox, STNavigationBar, STToolbar, AddressInput, Validator, LoadingButton, STListItem, STList, Spinner, TooltipDirective, Tooltip } from "@stamhoofd/components";
import { SessionManager, LoginHelper } from '@stamhoofd/networking';
import { Group, GroupGenderType, GroupPatch, GroupSettings, GroupSettingsPatch, Organization, OrganizationPatch, Address, OrganizationMetaData, Image, ResolutionRequest, ResolutionFit, Version, User } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";
import { OrganizationManager } from "../../../classes/OrganizationManager"
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import DomainSettingsView from './DomainSettingsView.vue';
import DNSRecordsView from './DNSRecordsView.vue';
import EmailSettingsView from './EmailSettingsView.vue';
import ChangePasswordView from './ChangePasswordView.vue';
import { Formatter } from '@stamhoofd/utility';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        BackButton,
        STListItem,
        STList,
        Spinner
    },
     directives: {
        tooltip: TooltipDirective
    },
    filters: {
        price: Formatter.price,
        date: Formatter.date.bind(Formatter)
    }
})
export default class CreditsView extends Mixins(NavigationMixin) {
}
</script>

<style lang="scss">
    #credits-view {
        .input-info {
            margin-top: 8px;
        }
    }
</style>