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
            <textarea
                v-model="description"
                class="input large"
                type="text"
                placeholder="Beschrijving die op jouw webshop staat"
                autocomplete=""
            />
        </STInputBox>


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

        <p>De foto wordt getoond met een grootte van 900 x 375, maar we raden aan om een foto van minstens 1800 x 750 te uploaden.</p>

        <figure v-if="coverPhotoSrc" class="webshop-banner">
            <img :src="coverPhotoSrc" :width="coverImageWidth" :height="coverImageHeight">
        </figure>


        <EditPolicyBox v-for="policy in policies" :key="policy.id" :policy="policy" :validator="validator" :error-box="errorBox" @patch="patchPolicy(policy, $event)" @delete="deletePolicy(policy)" />

        <hr>
        <h2 class="style-with-button">
            <div>Externe links</div>
            <div>
                <button type="button" class="button text only-icon-smartphone" @click="addPolicy">
                    <span class="icon add" />
                    <span>Toevoegen</span>
                </button>
            </div>
        </h2>
        <p>Soms wil je ook jouw algemene voorwaarden, retourbeleid, contactformulier en privacyvoorwaarden op jouw webshop vermelden. Als je online betaalmethodes wilt gebruiken, kan dit noodzakelijk zijn. Deze links worden dan onderaan jouw webshop toegevoegd.</p>

        <p v-if="policies.length == 0" class="info-box">
            Je hebt momenteel geen externe links toegevoegd.
        </p>
        <p v-if="policies.length > 0 && (organization.meta.privacyPolicyFile || organization.meta.privacyPolicyUrl)" class="warning-box">
            De privacyvoorwaarden die je bij de algemene instellingen hebt ingesteld, worden niet weergegeven in deze webshop. Voeg deze ook toe als externe link als je dezelfde privacy voorwaarden op deze webshop wilt vermelden.
        </p>
    </SaveView>
</template>

<script lang="ts">
import { AutoEncoderPatchType } from "@simonbackx/simple-encoding";
import { SaveView, STErrorsDefault, STInputBox, UploadButton } from "@stamhoofd/components";
import { Image, Policy, PrivateWebshop, ResolutionRequest, WebshopMetaData } from '@stamhoofd/structures';
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from "../../../../classes/OrganizationManager";
import EditPolicyBox from "./EditPolicyBox.vue";
import EditWebshopMixin from "./EditWebshopMixin";

@Component({
    components: {
        STInputBox,
        STErrorsDefault,
        UploadButton,
        EditPolicyBox,
        SaveView
    }
})
export default class EditWebshopPageView extends Mixins(EditWebshopMixin) {
    get organization() {
        return OrganizationManager.organization
    }

    get viewTitle() {
        return "Webshop pagina wijzigen"
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

    set description(description: string) {
        const patch = WebshopMetaData.patch({ description })
        this.addPatch(PrivateWebshop.patch({ meta: patch}) )
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
                width: 1600
            }),
            ResolutionRequest.create({
                width: 800
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
