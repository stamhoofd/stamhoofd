<template>
    <div class="st-view webshop-view-page">
        <STNavigationBar :title="viewTitle">
            <template #left>
                <BackButton v-if="canPop" @click="pop" />
            </template>
            <template #right>
                <button v-if="canDismiss" class="button icon close gray" @click="dismiss" />
            </template>
        </STNavigationBar>

        <main>
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
                    <button v-if="coverPhoto" class="button text" @click="coverPhoto = null">
                        <span class="icon trash" />
                        <span>Verwijderen</span>
                    </button>
                    <UploadButton v-model="coverPhoto" :text="coverPhoto ? 'Vervangen' : 'Foto uploaden'" :resolutions="hs" />
                </div>
            </h2>

            <p>De foto wordt getoond met een grootte van 900 x 375, maar we raden aan om een foto van minstens 1800 x 750 te uploaden.</p>

            <figure v-if="coverPhotoSrc" class="webshop-banner">
                <img :src="coverPhotoSrc" :width="coverImageWidth" :height="coverImageHeight">
            </figure>

            <hr>
            <h2>Link van jouw webshop</h2>

            <Checkbox v-model="hasCustomDomain">
                Eigen domeinnaam gebruiken
            </Checkbox>

            <template v-if="hasCustomDomain">
                <STInputBox title="Eigen link" error-fields="customUrl" :error-box="errorBox" class="max">
                    <input
                        v-model="customUrl"
                        class="input"
                        type="text"
                        :placeholder="$t('dashboard.inputs.shopUrl.placeholder')"
                        autocomplete=""
                        @blur="resetCache"
                    >
                </STInputBox>
                <p class="st-list-description">
                    {{ $t('dashboard.webshop.customDomain.description') }}
                </p>
            
                <template v-if="dnsRecord">
                    <STInputBox title="Stel deze DNS-records in" class="max">
                        <DNSRecordBox :record="dnsRecord" />
                    </STInputBox>
                </template>
            </template>

            <template v-else>
                <STInputBox title="Eigen achtervoegsel (optioneel)" error-fields="uri" :error-box="errorBox">
                    <input
                        v-model="uri"
                        class="input"
                        type="text"
                        placeholder="bv. wafelbak"
                        autocomplete=""
                        @blur="resetCache"
                    >
                </STInputBox>

                <STInputBox title="Jouw link" error-fields="url" :error-box="errorBox" class="max">
                    <input
                        v-tooltip="'Klik om te kopiëren'"
                        :value="url"
                        class="input"
                        type="text"
                        autocomplete=""
                        readonly
                        @click="copyElement"
                    >
                </STInputBox>
            </template>

            <EditPolicyBox v-for="policy in policies" :key="policy.id" :policy="policy" :validator="validator" :error-box="errorBox" @patch="patchPolicy(policy, $event)" @delete="deletePolicy(policy)" />

            <hr>
            <h2 class="style-with-button">
                <div>Externe links</div>
                <div>
                    <button class="button text" @click="addPolicy">
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
        </main>
        <STToolbar>
            <template slot="right">
                <LoadingButton :loading="saving">
                    <button class="button primary" @click="save">
                        Opslaan
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { AutoEncoderPatchType } from "@simonbackx/simple-encoding";
import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox,LoadingButton,STErrorsDefault, STInputBox, STList, STListItem, STNavigationBar, STToolbar, Tooltip, TooltipDirective, UploadButton } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { DNSRecord, DNSRecordType,Image, Policy, PrivateWebshop, ResolutionRequest, WebshopMetaData } from '@stamhoofd/structures';
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from "../../../../classes/OrganizationManager";
import DNSRecordBox from '../../../../components/DNSRecordBox.vue';
import EditPolicyBox from "./EditPolicyBox.vue"
import EditWebshopMixin from "./EditWebshopMixin";

@Component({
    components: {
        STListItem,
        STList,
        STInputBox,
        STErrorsDefault,
        UploadButton,
        Checkbox,
        DNSRecordBox,
        EditPolicyBox,
        STNavigationBar,
        BackButton,
        STToolbar,
        LoadingButton
    },
    directives: { Tooltip: TooltipDirective },
})
export default class EditWebshopPageView extends Mixins(EditWebshopMixin) {
    cachedHasCustomDomain: boolean | null = null
    cachedCustomUrl: string | null = null
    cachedUri: string | null = null

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

    resetCache() {
        this.cachedCustomUrl = null
        this.cachedUri = null
    }

    get hasCustomDomain() {
        if (this.cachedHasCustomDomain) {
            return this.cachedHasCustomDomain
        }
        return !!this.webshop.domain
    }

    set hasCustomDomain(hasCustomDomain: boolean) {
        this.cachedHasCustomDomain = hasCustomDomain

        if (!hasCustomDomain) {
            const patch = PrivateWebshop.patch({  })
            patch.domain = null
            patch.domainUri = null
            this.addPatch(patch)
        } else {
            // Force patch
            this.customUrl = this.customUrl as any
        }
    }

    get url() {
        return "https://"+this.webshop.getUrl(SessionManager.currentSession!.organization!)
    }

    get customUrl() {
        if (this.cachedCustomUrl) {
            return this.cachedCustomUrl
        }

        if (!this.webshop.domain) {
            return ""
        }
        return this.webshop.getUrl(SessionManager.currentSession!.organization!)
    }

    set customUrl(customUrl: string) {
        this.cachedCustomUrl = customUrl
        const split = customUrl.split("/")

        const patch = PrivateWebshop.patch({  })
        if (split[0].length == 0) {
            patch.domain = null
            patch.domainUri = null
        } else {
            patch.domain = split[0]

            if (!split[1] || split[1].length == 0) {
                patch.domainUri = null
            } else {
                patch.domainUri = split[1]
            }
        }

        this.addPatch(patch)
    }

    get uri() {
        return this.webshop.uri
    }

    set uri(uri: string) {
        this.cachedUri = uri

        const patch = PrivateWebshop.patch({  })
        patch.uri = uri

        this.addPatch(patch)
    }

    get dnsRecord() {
        if (!this.webshop.domain) {
            return null;
        }
        return DNSRecord.create({
            type: DNSRecordType.CNAME,
            name: this.webshop.domain+".",
            value: "domains.stamhoofd.shop."
        })
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

    copyElement(event) {
        event.target.contentEditable = true;

        document.execCommand('selectAll', false);
        document.execCommand('copy')

        event.target.contentEditable = false;

        const el = event.target;
        const rect = event.target.getBoundingClientRect();

        // Present

        const displayedComponent = new ComponentWithProperties(Tooltip, {
            text: "📋 Gekopieerd!",
            x: event.clientX,
            y: event.clientY + 10,
        });
        this.present(displayedComponent.setDisplayStyle("overlay"));

        setTimeout(() => {
            displayedComponent.vnode?.componentInstance?.$parent.$emit("pop");
        }, 1000);
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
        background: $color-gray;
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
