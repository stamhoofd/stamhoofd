<template>
    <div class="module-settings-box">
        <div class="module-box">
            <label :class="{ selected: enableMemberModule }">
                <div><img slot="left" src="~@stamhoofd/assets/images/illustrations/list.svg"></div>
                <div>
                    <h2 class="style-title-list">Inschrijvingen en ledenbeheer</h2>
                    <p class="style-description">Gratis</p>
                </div>
                <div>
                    <Checkbox v-model="enableMemberModule" />
                </div>
            </label>

            <label :class="{ selected: enableWebshopModule }">
                <div><img slot="left" src="~@stamhoofd/assets/images/illustrations/cart.svg"></div>
                <div>
                    <h2 class="style-title-list">Webshops</h2>
                    <p class="style-description">Tijdelijk gratis voor alle shops die je nu aanmaakt</p>
                </div>
                <div>
                    <Checkbox v-model="enableWebshopModule" />
                </div>
            </label>
        </div>

        <h3>Verwacht in de toekomst</h3>

        <div class="module-box">
            <label class="disabled">
                <div><img slot="left" src="~@stamhoofd/assets/images/illustrations/flag.svg"></div>
                <div>
                    <h2 class="style-title-list">Activiteiten</h2>
                    <p class="style-description">Maak activiteiten aan en laat leden inschrijven</p>
                </div>
                <div>
                    <span class="style-tag">2021</span>
                </div>
            </label>

            <label class="disabled">
                <div><img slot="left" src="~@stamhoofd/assets/images/illustrations/laptop.svg"></div>
                <div>
                    <h2 class="style-title-list">Bouw zelf je website</h2>
                    <p class="style-description">Maak een unieke website die je zelf kan aanpassen. Geen technische kennis vereist</p>
                </div>
                <div>
                    <span class="style-tag">2021</span>
                </div>
            </label>

            <label class="disabled">
                <div><img slot="left" src="~@stamhoofd/assets/images/illustrations/tickets.svg"></div>
                <div>
                    <h2 class="style-title-list">Ticketverkoop</h2>
                    <p class="style-description">Verkoop en scan tickets met je smartphone</p>
                </div>
                <div>
                    <span class="style-tag">2021</span>
                </div>
            </label>

            <label class="disabled">
                <div><img slot="left" src="~@stamhoofd/assets/images/illustrations/house.svg"></div>
                <div>
                    <h2 class="style-title-list">Verhuur materiaal en lokalen</h2>
                    <p class="style-description">Online reservaties, automatische contracten en kalenders</p>
                </div>
                <div>
                    <span class="style-tag">2021</span>
                </div>
            </label>
        </div>
    </div>
</template>

<script lang="ts">
import { AutoEncoderPatchType, PartialWithoutMethods } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, CenteredMessage, Checkbox, DateSelection, ErrorBox, FileInput,IBANInput, LoadingButton, Radio, RadioGroup, STErrorsDefault,STInputBox, STList, STListItem, STNavigationBar, STToolbar, Toast, TooltipDirective,Validator} from "@stamhoofd/components";
import { OrganizationMetaData, OrganizationModules, OrganizationPatch, UmbrellaOrganization } from "@stamhoofd/structures"
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from "../../../classes/OrganizationManager"
import EditGroupsView from '../groups/EditGroupsView.vue';
import MembersStructureSetupView from './modules/members/MembersStructureSetupView.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        Checkbox,
        DateSelection,
        RadioGroup,
        Radio,
        BackButton,
        LoadingButton,
        IBANInput,
        FileInput,
        STList,
        STListItem
    },
    directives: {
        tooltip: TooltipDirective
    }
})
export default class ModuleSettingsView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false
    temp_organization = OrganizationManager.organization
    showDomainSettings = true
    loadingMollie = false

    get organization() {
        return OrganizationManager.organization
    }

    patchModule(patch: PartialWithoutMethods<AutoEncoderPatchType<OrganizationModules>>, message: string) {
        OrganizationManager.patch(OrganizationPatch.create({
            id: this.organization.id,
            meta: OrganizationMetaData.patch({
                modules: OrganizationModules.patch(patch)
            })
        })).then(() => {
            new Toast(message, "success green").show()
        }).catch(e => {
            CenteredMessage.fromError(e).show()
        })
    }

    get enableMemberModule() {
        return this.organization.meta.modules.useMembers
    }

    set enableMemberModule(enable: boolean) {
        if (!enable || this.organization.groups.length > 0) {
            this.organization.meta.modules.useMembers = enable
            this.patchModule({ useMembers: enable }, enable ? "De ledenadministratie module is nu actief" : "De ledenadministratie module is nu uitgeschakeld")
        } else {
            if (enable && this.organization.meta.umbrellaOrganization && [UmbrellaOrganization.ChiroNationaal, UmbrellaOrganization.ScoutsEnGidsenVlaanderen].includes(this.organization.meta.umbrellaOrganization)) {
                // We have an automated flow for these organizations
                this.present(new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(MembersStructureSetupView, {})
                }).setDisplayStyle("popup"))
            } else {
                // Activate + show groups
                this.patchModule({ useMembers: enable }, enable ? "De ledenadministratie module is nu actief" : "De ledenadministratie module is nu uitgeschakeld")
                this.present(new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(EditGroupsView, {})
                }).setDisplayStyle("popup"))
            }
            
        }
    }

    get enableWebshopModule() {
        return this.organization.meta.modules.useWebshops
    }

    set enableWebshopModule(enable: boolean) {
        this.organization.meta.modules.useWebshops = enable
        this.patchModule({ useWebshops: enable }, enable ? "De webshop module is nu actief" : "De webshop module is nu uitgeschakeld")
    }

}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;


.module-settings-box {
    > h3 {
        @extend .style-label;
        padding-bottom: 10px;
    }

    .module-box {
        display: grid;
        gap: 10px;
        grid-template-columns: 50% 50%;
        grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));

        // auto-fill is causing a weird unfixable overflow bug, so hard fix it:
        @media (max-width: 800px) {
            grid-template-columns: 100%;
        }

        > label {
            min-width: 0;
            max-width: 100%;
            box-sizing: border-box;
            padding: 30px 20px;
            border-radius: $border-radius;
            background: $color-white-shade;
            display: flex;
            flex-direction: row;     
            align-items: center;    
            cursor: pointer;
            touch-action: manipulation;
            -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
            user-select: none;

            @media (max-width: 400px) {
                padding: 20px 15px;
            }

            &.selected{
                background: $color-primary-background;
            }

            &.disabled {
                cursor: default;
            }
            
            img {
                @extend .style-illustration-img;
            }

            > div {
                min-width: 0;
                overflow: hidden;
            }

            > div:first-child {
                flex-shrink: 0;
                padding-right: 15px;
            }

            > div:last-child {
                margin-left: auto;
                flex-shrink: 0;
                padding-left: 10px;
            }
        }
    }
}


</style>
