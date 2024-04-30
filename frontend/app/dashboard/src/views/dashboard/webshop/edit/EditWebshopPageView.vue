<template>
    <SaveView :title="viewTitle" :loading="saving" :disabled="!hasChanges" class="webshop-view-page" @save="save">
        <h1>{{ viewTitle }}</h1>
        <STErrorsDefault :error-box="errorBox" />
        <STInputBox title="Titel" error-fields="meta.title" :error-box="errorBox">
            <input
                v-model="title"
                class="input"
                type="text"
                placeholder="bv. Bestel je wafels"
                autocomplete=""
            >
        </STInputBox>

        <STInputBox title="Beschrijving" error-fields="meta.description" :error-box="errorBox" class="max">
            <WYSIWYGTextInput
                v-model="description"
                placeholder="Beschrijving die op jouw webshop staat"
                :color="color || defaultColor"
            />
        </STInputBox>

        <hr>
        <h2>Layout</h2>

        <STList>
            <STListItem :selectable="true" element-name="label" class="left-center">
                <template #left>
                    <Radio v-model="layout" :value="WebshopLayout.Split" />
                </template>
                <h3 class="style-title-list">
                    Naast elkaar
                </h3>
                <p class="style-description">
                    Indien er voldoende plaats is. Meerdere artikels worden in lijstweergave getoond.
                </p>
            </STListItem>
            <STListItem :selectable="true" element-name="label" class="left-center">
                <template #left>
                    <Radio v-model="layout" :value="WebshopLayout.Default" />
                </template>
                <h3 class="style-title-list">
                    Onder elkaar
                </h3>
                <p class="style-description">
                    Meerdere artikels worden in vakjes getoond, indien er voldoende plaats is.
                </p>
            </STListItem>
        </STList>

        <hr>
        <h2 class="style-with-button">
            <div>Omslagfoto</div>
            <div>
                <button v-if="coverPhoto" type="button" class="button text only-icon-smartphone" @click="coverPhoto = null">
                    <span class="icon trash" />
                    <span>Verwijderen</span>
                </button>
                <UploadButton v-model="coverPhoto" :text="coverPhoto ? 'Vervangen' : 'Uploaden'" :resolutions="hs" />
            </div>
        </h2>

        <p>We raden aan om een foto van minstens 1600 pixels breed up te loaden. De foto zal volledig zichtbaar zijn, knip dus indien nodig bij voor het uploaden.</p>

        <figure v-if="coverPhotoSrc" class="webshop-banner">
            <img :src="coverPhotoSrc" :width="coverImageWidth" :height="coverImageHeight">
        </figure>


        <EditPolicyBox v-for="policy in policies" :key="policy.id" :policy="policy" :validator="validator" :error-box="errorBox" @patch="patchPolicy(policy, $event)" @delete="deletePolicy(policy)" />

        <hr>
        <h2 class="style-with-button">
            <div>Externe links</div>
            <div>
                <button type="button" class="button icon add" @click="addPolicy" />
            </div>
        </h2>
        <p>Soms wil je ook jouw algemene voorwaarden, retourbeleid, contactformulier en privacyvoorwaarden op jouw webshop vermelden. Als je online betaalmethodes wilt gebruiken, kan dit noodzakelijk zijn. Deze links worden dan onderaan jouw webshop toegevoegd.</p>

        <p v-if="policies.length == 0" class="info-box">
            Je hebt momenteel geen externe links toegevoegd.
        </p>
        <p v-if="policies.length > 0 && (organization.meta.privacyPolicyFile || organization.meta.privacyPolicyUrl)" class="warning-box">
            De privacyvoorwaarden die je bij de algemene instellingen hebt ingesteld, worden niet weergegeven in deze webshop. Voeg deze ook toe als externe link als je dezelfde privacy voorwaarden op deze webshop wilt vermelden.
        </p>

        <hr>
        <h2>Kleuren</h2>
        <p>
            Je kan de hoofdkleur voor al je webshops instellen via de algemene instellingen → Personaliseren. Dan hoef je het niet voor elke webshop apart in te stellen. Het kleur hier invullen heeft enkel nut als je het bewust anders wilt instellen.
        </p>

        <ColorInput v-model="color" title="Hoofdkleur (optioneel)" :validator="validator" placeholder="Standaardkleur" :required="false" :disallowed="['#FFFFFF']" />
        <p class="style-description-small">
            Vul hierboven de HEX-kleurcode van jouw hoofdkleur in. Laat leeg om de kleur van je vereniging te behouden (bij algemene instellingen > personalisatie).
        </p>

        <STInputBox title="Donkere mode" error-fields="meta.darkMode" :error-box="errorBox" class="max">
            <RadioGroup>
                <Radio v-model="darkMode" :value="'Off'">
                    Uit
                </Radio>
                <Radio v-model="darkMode" :value="'On'">
                    Aan
                </Radio>
                <Radio v-model="darkMode" :value="'Auto'">
                    Automatisch
                </Radio>
            </RadioGroup>
        </STInputBox>
        <p v-if="darkMode !== 'Off'" class="style-description-small">
            Test zeker het contrast van jouw gekozen kleur en logo als je voor een donkere modus kiest.
        </p>

        <hr>
        <h2>Logo</h2>
        <p>
            Je kan een logo voor al je webshops instellen via de algemene instellingen > personalisatie. Dan hoef je het niet voor elke webshop apart in te stellen.
        </p>

        <LogoEditor :meta-data="webshop.meta" :validator="validator" :default-to-organization="true" :dark-mode="darkMode" @patch="addMetaPatch" />

        <template v-if="hasTickets">
            <hr>
            <EditSponsorsBox :config="sponsorConfig" @patch="patchSponsorConfig" />

            <p class="style-button-bar">
                <button type="button" class="button text" @click="previewTicket">
                    <span class="icon eye" /><span>Ticketvoorbeeld</span>
                </button>
            </p>
        </template>

        <hr>
        <h2>Stamhoofd</h2>
        <p>
            Stamhoofd toont op enkele plaatsen het logo van Stamhoofd op jullie webshop. Op die manier kunnen we Stamhoofd bekender maken bij andere verenigingen, waardoor we Stamhoofd ook betaalbaar kunnen houden. Je kan dit verminderen als je dit toch liever niet wilt.
        </p>

        <Checkbox v-model="reduceBranding">
            Verminder de zichtbaarheid van Stamhoofd
        </Checkbox>
    </SaveView>
</template>

<script lang="ts">
import { AutoEncoderPatchType } from "@simonbackx/simple-encoding";
import { ComponentWithProperties, NavigationController } from "@simonbackx/vue-app-navigation";
import { Checkbox,ColorInput, DetailedTicketView, LogoEditor, Radio, RadioGroup, SaveView, STErrorsDefault, STInputBox, STList, STListItem, Toast, UploadButton, WYSIWYGTextInput } from "@stamhoofd/components";
import { UrlHelper } from "@stamhoofd/networking";
import { Cart, CartReservedSeat, TicketPublic } from "@stamhoofd/structures";
import { CartItem } from "@stamhoofd/structures";
import { DarkMode, Image, Policy, PrivateWebshop, ProductType, ResolutionRequest, RichText, SponsorConfig, WebshopLayout, WebshopMetaData } from '@stamhoofd/structures';
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";


import EditSponsorsBox from "../../sponsors/EditSponsorsBox.vue"
import EditPolicyBox from "./EditPolicyBox.vue";
import EditWebshopMixin from "./EditWebshopMixin";

@Component({
    components: {
        STInputBox,
        STErrorsDefault,
        UploadButton,
        EditPolicyBox,
        SaveView,
        STList,
        STListItem,
        Radio,
        RadioGroup,
        WYSIWYGTextInput,
        LogoEditor,
        ColorInput,
        EditSponsorsBox,
        Checkbox
    }
})
export default class EditWebshopPageView extends Mixins(EditWebshopMixin) {
    mounted() {
        UrlHelper.setUrl("/webshops/" + Formatter.slug(this.webshop.meta.name) + "/settings/page")
    }

    get organization() {
        return this.$organization
    }

    get viewTitle() {
        return "Webshop pagina wijzigen"
    }

    get hasTickets() {
        return this.webshop.hasTickets
    }

    addMetaPatch(patch: AutoEncoderPatchType<WebshopMetaData>) {
        this.addPatch(PrivateWebshop.patch({ meta: patch}) )
    }

    patchPolicy(policy: Policy, patch: AutoEncoderPatchType<Policy>) {
        const p = WebshopMetaData.patch({})
        patch.id = policy.id
        p.policies.addPatch(patch)
        this.addPatch(PrivateWebshop.patch({ meta: p }) )
    }

    deletePolicy(policy: Policy) {
        const p = WebshopMetaData.patch({})
        p.policies.addDelete(policy.id)
        this.addPatch(PrivateWebshop.patch({ meta: p }) )
    }

    addPolicy() {
        const p = WebshopMetaData.patch({})
        p.policies.addPut(Policy.create({}))
        this.addPatch(PrivateWebshop.patch({ meta: p }) )
    }

    get policies() {
        return this.webshop.meta.policies
    }

    get title() {
        return this.webshop.meta.title
    }

    set title(title: string) {
        const patch = WebshopMetaData.patch({ title })
        this.addPatch(PrivateWebshop.patch({ meta: patch}) )
    }

    get description() {
        return this.webshop.meta.description
    }

    set description(description: RichText) {
        const patch = WebshopMetaData.patch({ description })
        this.addPatch(PrivateWebshop.patch({ meta: patch}) )
    }

    get reduceBranding() {
        return this.webshop.meta.reduceBranding
    }

    set reduceBranding(reduceBranding: boolean) {
        const patch = WebshopMetaData.patch({ reduceBranding })
        this.addPatch(PrivateWebshop.patch({ meta: patch}) )
    }

    get WebshopLayout() {
        return WebshopLayout
    }

    get layout() {
        return this.webshop.meta.layout
    }

    set layout(layout: WebshopLayout) {
        const patch = WebshopMetaData.patch({ layout })
        this.addPatch(PrivateWebshop.patch({ meta: patch }) )
    }

    get defaultColor() {
        return this.organization.meta.color ?? null
    }

    get color() {
        return this.webshop.meta.color
    }

    set color(color: string | null) {
        const patch = WebshopMetaData.patch({ color })
        this.addPatch(PrivateWebshop.patch({ meta: patch }) )
    }

    get darkMode() {
        return this.webshop.meta.darkMode
    }

    set darkMode(darkMode: DarkMode) {
        const patch = WebshopMetaData.patch({ darkMode })
        this.addPatch(PrivateWebshop.patch({ meta: patch }) )
    }

    get coverPhoto() {
        return this.webshop.meta.coverPhoto
    }

    set coverPhoto(coverPhoto: Image | null) {
        const patch = WebshopMetaData.patch({ coverPhoto })
        this.addPatch(PrivateWebshop.patch({ meta: patch }) )
    }

    get hs() {
        return [
            ResolutionRequest.create({
                width: 1800
            }),
            ResolutionRequest.create({
                width: 900
            })
        ]
    }

    get coverPhotoResolution() {
        const image = this.coverPhoto
        if (!image) {
            return null
        }
        return image.getResolutionForSize(800, 200)
    }

    get coverPhotoSrc() {
        const image = this.coverPhoto
        if (!image) {
            return null
        }
        return this.coverPhotoResolution?.file.getPublicPath()
    }
    
    get coverImageWidth() {
        return this.coverPhotoResolution?.width
    }

    get coverImageHeight() {
        return this.coverPhotoResolution?.height
    }

    get sponsorConfig() {
        return this.webshop.meta.sponsors
    }

    patchSponsorConfig(config: AutoEncoderPatchType<SponsorConfig>|null) {
        this.addMetaPatch(WebshopMetaData.patch({sponsors: config}))
    }

    previewTicket() {
        // Example product:
        const product = this.webshop.products.find(p => p.type === ProductType.Ticket) ?? this.webshop.products[0];

        if (!product) {
            new Toast('Voeg ten minste één ticket toe aan je webshop om een voorbeeld van een ticket te bekijken', 'error red').show()
            return;
        }
        const cart = Cart.create({})
        const item = CartItem.createDefault(product, cart, this.webshop, {admin: true})

        const seatingPlan = product.seatingPlanId ? this.webshop.meta.seatingPlans.find(s => s.id === product.seatingPlanId) : null
        const section = seatingPlan ? seatingPlan.sections[0] : null;
        const row = section ? section.rows.filter(r => r.label && r.seatCount > 0)[Math.floor(section.rows.filter(r => r.label && r.seatCount > 0).length / 2)] : null;
        const seat = row ? row.seats.filter(s => s.isValidSeat)[Math.floor(row.seats.filter(s => s.isValidSeat).length/2)] : null;

        const reservedSeat = seat ? CartReservedSeat.create({
            section: section!.id,
            row: row!.label,
            seat: seat.label
        }) : null;


        if (reservedSeat && seatingPlan) {
            reservedSeat.calculatePrice(seatingPlan)
        }

        const ticket = TicketPublic.create({
            items: [item],
            secret: 'VRBLDTICKET',
            index: 1,
            total: 1,
            seat: reservedSeat
        })

        this.present({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(DetailedTicketView, {
                        organization: this.organization,
                        webshop: this.webshop,
                        ticket
                    })
                })
            ],
            modalDisplayStyle: "sheet"
        })
    }

}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/base/text-styles.scss';

.webshop-view-page {
    .image {
        display: block;
        max-width: 100%;
        max-height: 200px;
        width: auto;
        height: auto;
    }

     .webshop-banner {
        height: 300px;
        background: $color-gray-3;
        border-radius: $border-radius;
        margin-top: 20px;

        img {
            border-radius: $border-radius;
            height: 100%;
            width: 100%;
            object-fit: cover;
        }

        @media (max-width: 800px) {
            border-radius: 0;
            margin: 0 calc(-1 * var(--st-horizontal-padding, 40px));
            margin-top: 20px;
            height: calc(100vw / 720 * 300);

            img {
                border-radius: 0;
            }
        }
    }
}
</style>
