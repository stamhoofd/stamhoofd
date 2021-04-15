<template>
    <main class="webshop-view-page">
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
                class="input"
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
                <UploadButton v-model="coverPhoto" :text="coverPhoto ? 'Vervangen' : 'Foto uploaden'" :hs="hs" />
            </div>
        </h2>

        <p>De foto wordt getoond met een grootte van 900 x 375, maar we raden aan om een foto van minstens 1800 x 750 te uploaden.</p>

        <figure v-if="coverPhotoSrc" class="webshop-banner">
            <img :src="coverPhotoSrc" :width="coverImageWidth" :height="coverImageHeight">
        </figure>

        <hr>
        <h2>Link</h2>

        <Checkbox v-model="hasCustomDomain">
            Eigen domeinnaam gebruiken
        </Checkbox>

        <template v-if="hasCustomDomain">
            <STInputBox title="Eigen link" error-fields="customUrl" :error-box="errorBox" class="max">
                <input
                    v-model="customUrl"
                    class="input"
                    type="text"
                    placeholder="bv. shop.domeinnaam.be/wafelbak"
                    autocomplete=""
                    @blur="resetCache"
                >
            </STInputBox>
            <p class="st-list-description">
                Hier kan je je eigen domeinnaam kiezen, en eventueel met een achtervoegsel. Zo kan je bijvoorbeeld al je verkopen organiseren op shop.domeinnaam.be/wafelbak, met daarachter telkens een ander achtervoegsel. Maar dat achtervoegsel is optioneel, je kan ook wafelbak.domeinnaam.be gebruiken. Voordeel van de eerste oplossing is dat jouw webmaster maar één keer DNS wijzigingen moet doen.
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
    </main>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox,ErrorBox, STErrorsDefault, STInputBox, STList, STListItem, Tooltip, TooltipDirective, UploadButton, Validator } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { DNSRecord, DNSRecordType,Image, PrivateWebshop, ResolutionRequest, WebshopMetaData } from '@stamhoofd/structures';
import { Component, Mixins,Prop } from "vue-property-decorator";

import DNSRecordBox from './../../../components/DNSRecordBox.vue';

@Component({
    components: {
        STListItem,
        STList,
        STInputBox,
        STErrorsDefault,
        UploadButton,
        Checkbox,
        DNSRecordBox
    },
    directives: { Tooltip: TooltipDirective },
})
export default class EditWebshopPageView extends Mixins(NavigationMixin) {
    @Prop()
    webshop!: PrivateWebshop;

    errorBox: ErrorBox | null = null
    validator = new Validator()

    cachedHasCustomDomain: boolean | null = this.hasCustomDomain
    cachedCustomUrl: string | null = this.customUrl
    cachedUri: string | null = this.uri

    get title() {
        return this.webshop.meta.title
    }

    set title(title: string) {
        const patch = WebshopMetaData.patch({ title })
        this.$emit("patch", PrivateWebshop.patch({ meta: patch}) )
    }

    get description() {
        return this.webshop.meta.description
    }

    set description(description: string) {
        const patch = WebshopMetaData.patch({ description })
        this.$emit("patch", PrivateWebshop.patch({ meta: patch}) )
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
            this.$emit("patch", patch)
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

        this.$emit("patch", patch)
    }

    get uri() {
        return this.webshop.uri
    }

    set uri(uri: string) {
        this.cachedUri = uri

        const patch = PrivateWebshop.patch({  })
        patch.uri = uri

        this.$emit("patch", patch)
    }

    get dnsRecord() {
        if (!this.webshop.domain) {
            return null;
        }
        return DNSRecord.create({
            type: DNSRecordType.CNAME,
            name: this.webshop.domain+".",
            value: "domains.stamhoofd.shop"
        })
    }

    get coverPhoto() {
        return this.webshop.meta.coverPhoto
    }

    set coverPhoto(coverPhoto: Image | null) {
        const patch = WebshopMetaData.patch({ coverPhoto })
        this.$emit("patch", PrivateWebshop.patch({ meta: patch }) )
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
