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

            <p v-if="legacyUrl" class="info-box">
                We hebben het formaat gewijzigd van webshop links. Maar jouw webshop is (en blijft) ook bereikbaar via {{ legacyUrl }}. In toekomstige communicaties gebruik je best de niewe link, maar pas de nieuwe link eerst aan naar wens.
            </p>

            <STErrorsDefault :error-box="errorBox" />
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
export default class EditWebshopLinkView extends Mixins(EditWebshopMixin) {
    cachedHasCustomDomain: boolean | null = null
    cachedCustomUrl: string | null = null
    cachedUri: string | null = null

    get organization() {
        return OrganizationManager.organization
    }

    get viewTitle() {
        return "Webshop link wijzigen"
    }

    get legacyUrl() {
        return this.webshop.getLegacyUrl(OrganizationManager.organization)
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