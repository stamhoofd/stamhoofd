<template>
    <SaveView :title="viewTitle" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>{{ viewTitle }}</h1>
        <p>
            Lees zeker ook onze <a :href="'https://'+$t('shared.domains.marketing')+'/docs/webshop-link-wijzigen/'" target="_blank" class="inline-link">documentatie hierover</a> na.
        </p>

        <p v-if="legacyUrl && webshop.domain === null" class="info-box">
            We hebben het formaat gewijzigd van webshop links. Maar jouw webshop is (en blijft) ook bereikbaar via {{ legacyUrl }}. In toekomstige communicaties gebruik je best de nieuwe link, maar pas de nieuwe link eerst aan naar wens.
        </p>

        <p v-if="hasOrders" class="warning-box">
            Opgelet: als je de link naar jouw webshop aanpast, werken mogelijks sommige links in al verzonden e-mails niet meer. De enige uitzondering hierop is als je van een standaard Stamhoofd link overschakelt op een eigen domeinnaam (dan blijven oude links werken). Doe dit dus enkel in het begin van een verkoop.
        </p>

        <STErrorsDefault :error-box="errorBox" />

        <STInputBox title="Domeinnaam">
            <Dropdown v-model="selectedDomain" @update:model-value="onChangeSelectedDomain">
                <option :value="null">
                    {{ defaultDomain }}
                </option>
                <option v-for="d of defaultDomains" :key="d" :value="d">
                    {{ d }}
                </option>
                <option :value="''">
                    Andere domeinnaam
                </option>
            </Dropdown>
        </STInputBox>

        <template v-if="useNewDomain">
            <STInputBox title="Jouw webshop link" error-fields="customUrl" :error-box="errorBox" class="max">
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
            
            <template v-if="didDNSRecordsChange">
                <p class="info-box">
                    Jouw webmaster zal enkele wijzigingen moeten doen om deze link mogelijk te maken. We geven je de instructies in de volgende stap.
                </p>
            </template>
            <template v-else>
                <p v-if="webshop.meta.domainActive && originalWebshop.domain == webshop.domain" class="success-box">
                    Jouw domeinnaam is correct geconfigureerd.
                </p>
                <p v-else class="warning-box with-button selectable" @click="openDnsRecordSettings(false)">
                    Jouw domeinnaam is momenteel nog niet actief. Breng de nodige DNS-wijzigingen in orde, dit kan tot 24 uur duren.

                    <button class="button text" type="button">
                        Instellen
                    </button>
                </p>
                <p v-if="webshop.meta.domainActive && originalWebshop.domain == webshop.domain">
                    <button type="button" class="button text" @click="openDnsRecordSettings(false)">
                        Bekijk DNS-records instructies
                    </button>
                </p>
            </template>

            <p v-if="!webshop.meta.domainActive" class="info-box">
                Jouw webshop blijft ook bereikbaar via {{ defaultUrl }}. Die link kan je gebruiken om je webshop te bezoeken in tussentijd, tot de DNS-records zijn aangepast (kan tot 24 uur duren).
            </p>
        </template>

        <template v-else-if="selectedDomain !== null">
            <STInputBox title="Jouw webshop link" error-fields="domainUri" :error-box="errorBox" class="max">
                <template #right><button type="button" class="button text" @click="copyLink">
                    <span class="icon copy" />
                    <span>Kopiëren</span>
                </button></template>
                <PrefixInput v-model="domainUri" placeholder="bv. wafelbak" :prefix="domainUri ? webshop.domain+'/' : webshop.domain" :focus-prefix="webshop.domain+'/'" :fade-prefix="!!domainUri" @blur="resetCache" />
            </STInputBox>
            <p class="style-description-small">
                Vul eventueel iets in na het streepje (/), maar dat is niet verplicht.
            </p>
        </template>

        <template v-else>
            <STInputBox title="Jouw webshop link" error-fields="uri" :error-box="errorBox" class="max custom-bottom-box" :class="{'input-success': isAvailable && !checkingAvailability && availabilityCheckerCount > 0, 'input-errors': !isAvailable && !checkingAvailability && availabilityCheckerCount > 0}">
                <template #right><button type="button" class="button text" @click="copyLink">
                    <span class="icon copy" />
                    <span>Kopiëren</span>
                </button></template>
                <PrefixInput v-model="uri" placeholder="bv. wafelbak" :prefix="defaultDomain+'/'" @blur="updateUri" />
            </STInputBox>

            <template v-if="errorBox === null && ((availabilityCheckerCount > 0 && isAvailable !== null) || checkingAvailability)">
                <p v-if="checkingAvailability" class="loading-box">
                    <Spinner />
                    Nakijken of deze link nog beschikbaar is...
                </p>

                <p v-else-if="uri.length == 0" class="error-box">
                    Je moet verplicht iets na de domeinnaam invullen.
                </p>

                <p v-else-if="!isAvailable" class="error-box">
                    Deze link is al in gebruik. Kies een andere. Voeg iets uniek toe, bv. de naam van je vereniging.
                </p>

                <p v-else class="success-box">
                    Deze link is nog beschikbaar!
                </p>
            </template>
        </template>
    </SaveView>
</template>

<script lang="ts">
import { Decoder } from "@simonbackx/simple-encoding";
import { isSimpleError, isSimpleErrors, SimpleError } from "@simonbackx/simple-errors";
import { Request } from "@simonbackx/simple-networking";
import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { Dropdown, PrefixInput, SaveView, Spinner, STErrorsDefault, STInputBox, Toast, Tooltip } from "@stamhoofd/components";
import { SessionManager, UrlHelper } from '@stamhoofd/networking';
import { DNSRecordStatus, PrivateWebshop, WebshopUriAvailabilityResponse } from '@stamhoofd/structures';
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins } from "vue-property-decorator";


import EditWebshopMixin from "./EditWebshopMixin";
import WebshopDNSRecordsView from "./WebshopDNSRecordsView.vue";

const throttle = (func, limit) => {
    let lastFunc;
    let lastRan;
    return function() {
        const context = this;
        // eslint-disable-next-line prefer-rest-params
        const args = arguments;
        if (lastRan) {
            clearTimeout(lastFunc);
        }
        lastRan = Date.now();
            
        lastFunc = setTimeout(function() {
            if (Date.now() - lastRan >= limit) {
                func.apply(context, args);
                lastRan = Date.now();
            }
        }, limit - (Date.now() - lastRan));
    };
};

@Component({
    components: {
        STInputBox,
        STErrorsDefault,
        SaveView,
        PrefixInput,
        Spinner,
        Dropdown
    }
})
export default class EditWebshopLinkView extends Mixins(EditWebshopMixin) {
    cachedHasCustomDomain: boolean | null = null
    cachedCustomUrl: string | null = null

    checkingAvailability = false
    availabilityCheckerCount = 0
    isAvailable: boolean | null = null
    checkedUri = ""

    selectedDomain: string | null = null
    hasOrders = false

    created() {
        this.hasOrders = !!this.webshopManager?.lastFetchedOrder

        if (!this.hasOrders && this.webshopManager) {
            this.webshopManager.streamOrders(() => {
                this.hasOrders = true;
                throw new Error("Stop streaming")
            }, true).then().catch(console.error)
        }
    }

    mounted() {
        UrlHelper.setUrl("/webshops/" + Formatter.slug(this.webshop.meta.name) + "/settings/link")
        this.selectedDomain = this.webshop.meta.domainActive ? this.webshop.domain : (this.webshop.domain ? '' : null)
    }

    get defaultDomains() {
        return Formatter.uniqueArray(this.organization.webshops.filter(w => w.meta.domainActive && w.domain).map(w => w.domain))
    }

    onChangeSelectedDomain() {
        this.cachedCustomUrl = null
        if (this.selectedDomain !== null && this.selectedDomain !== '') {
            const patch = PrivateWebshop.patch({ domain: this.selectedDomain })
            this.addPatch(patch)
        }
        if (this.selectedDomain === null) {
            const patch = PrivateWebshop.patch({ domain: null })
            this.addPatch(patch)
        }
    }

    doThrottledCheckUriAvailability = throttle(this.checkUriAvailability, 1000)

    quickValidate() {
        if (Formatter.slug(this.uri).length == 0 ) {
            this.isAvailable = false
            this.checkedUri = ""

            // Invalidate all currently working checks
            this.availabilityCheckerCount++;

            // Mark loading as done
            this.checkingAvailability = false
            return true
        }

        if (Formatter.slug(this.uri) === this.originalWebshop.uri) {
            this.isAvailable = true
            this.checkedUri = this.originalWebshop.uri

            // Invalidate all currently working checks
            if (this.availabilityCheckerCount === 0) {
                // keep at zero, no need to say again that it is valid
            } else {
                this.availabilityCheckerCount++;
            }

            // Mark loading as done
            this.checkingAvailability = false
            return true
        }

        if (Formatter.slug(this.uri) === this.checkedUri || Formatter.slug(this.uri) === this.originalWebshop.uri) {
            // keep same state
            // Invalidate all currently working checks
            this.availabilityCheckerCount++;

            // Mark loading as done
            this.checkingAvailability = false
            return true
        }
        return false
    }

    throttledCheckUriAvailability() {
        this.errorBox = null
        Request.cancelAll(this)
        if (this.quickValidate()) {
            return
        }
        this.availabilityCheckerCount++;
        this.checkingAvailability = true
        this.isAvailable = null
        this.doThrottledCheckUriAvailability()
    }

    get organization() {
        return this.$organization
    }

    get viewTitle() {
        return "Webshop link wijzigen"
    }

    get legacyUrl() {
        return this.webshop.getLegacyUrl(this.$organization)
    }

    get defaultUrl() {
        return this.webshop.getDefaultUrl(this.$organization)
    }

    updateUri(){
        const cleaned = Formatter.slug(this.uri)
        if (cleaned !== this.uri) {
            this.uri = cleaned
            new Toast("Een link mag geen spaties, speciale tekens of hoofdletters bevatten", "info").show()
        }
        this.throttledCheckUriAvailability()
    }

    resetCache() {
        this.cachedCustomUrl = null
    }

    beforeUnmount() {
        Request.cancelAll(this)
    }

    async checkUriAvailability() {
        if (this.quickValidate()) {
            return
        }

        this.availabilityCheckerCount++
        const c = this.availabilityCheckerCount
        const uri = Formatter.slug(this.uri)
        this.checkingAvailability = true
        this.isAvailable = false

        Request.cancelAll(this)

        try {
            this.errorBox = null
            const response = await this.$context.authenticatedServer.request({
                path: "/webshop/"+this.webshop.id+"/check-uri",
                method: "GET",
                query: {
                    uri
                },
                decoder: WebshopUriAvailabilityResponse as Decoder<WebshopUriAvailabilityResponse>,
                owner: this,
                shouldRetry: false
            })

            if (this.availabilityCheckerCount !== c || uri != Formatter.slug(this.uri)) {
                console.info("Ignored response, counter or uri has already changed")
                // Ignore, because a new request has already started
                return
            }

            this.checkedUri = uri

            this.checkingAvailability = false
            if (response.data.available) {
                this.isAvailable = true
            } else {
                this.isAvailable = false
            }
        } catch (e) {
            Toast.fromError(e).show()
            this.checkingAvailability = false
            this.isAvailable = null
            throw e;
        }
        
    }

    get useNewDomain() {
        if (this.selectedDomain == "") {
            return true
        }
        return false
    }

    get defaultDomain() {
        return this.webshop.getDefaultDomain(this.$organization)
    }

    get url() {
        return "https://"+this.webshop.getUrl(this.$organization)
    }

    get customUrl() {
        if (this.cachedCustomUrl) {
            return this.cachedCustomUrl
        }

        if (!this.webshop.domain) {
            return ""
        }
        return this.webshop.getDomainUrl()
    }

    set customUrl(customUrl: string) {
        this.cachedCustomUrl = customUrl
        const split = customUrl.split("/")

        const patch = PrivateWebshop.patch({  })
        if (split[0].length == 0) {
            patch.domain = null
            patch.domainUri = ""
        } else {
            patch.domain = split[0].toLowerCase().replace(/[^a-zA-Z0-9-.]/g, '');

            if (!split[1] || split[1].length == 0) {
                patch.domainUri = ""
            } else {
                patch.domainUri = Formatter.slug(split[1])
            }
        }

        this.addPatch(patch)
    }

    get domainUri() {
        return this.webshop.domainUri
    }

    set domainUri(domainUri: string | null) {
        this.resetCache()
        const patch = PrivateWebshop.patch({ domainUri: domainUri ? Formatter.slug(domainUri) : "" })
        this.addPatch(patch)
    }

    get uri() {
        return this.webshop.uri
    }

    set uri(uri: string) {
        const patch = PrivateWebshop.patch({  })
        patch.uri = uri

        this.addPatch(patch)

        this.throttledCheckUriAvailability()
    }

    openDnsRecordSettings(replace = false) {
        const component = new ComponentWithProperties(WebshopDNSRecordsView, {
            webshopManager: this.webshopManager,
        })

        if (replace) {
            this.show({
                components: [component],
                animated: true
            })
        } else {
            this.present({
                components: [component],
                modalDisplayStyle: "popup"
            })
        }
    }

    shouldDismiss(): Promise<boolean> | boolean {
        if (this.webshop.privateMeta.dnsRecords.find(r => r.status !== DNSRecordStatus.Valid )) {
            this.openDnsRecordSettings(true)
            return false
        }
        return true
    }

    get didDNSRecordsChange(): boolean {
        const currently = this.webshop.privateMeta.dnsRecords

        if (currently.length != this.dnsRecords.length) {
            return true
        }

        for (let i = 0; i < currently.length; i++) {
            if (currently[i].type != this.dnsRecords[i].type || currently[i].value != this.dnsRecords[i].value || currently[i].name != this.dnsRecords[i].name) {
                return true
            }
        }
        return false
    }

    get dnsRecords() {
        if (!this.webshop.domain) {
            return [];
        }
        return this.webshop.buildDNSRecords()
    }

    async copyLink(event) {
        if (navigator.clipboard) {
            await navigator.clipboard.writeText(this.url)
        } else {
            const input = document.createElement("input")
            input.value = this.url
            document.body.appendChild(input)
            input.select()
            document.execCommand("copy")
            document.body.removeChild(input)
        }

        const displayedComponent = new ComponentWithProperties(Tooltip, {
            text: "Link gekopieerd!",
            x: event.clientX,
            y: event.clientY + 10,
        });
        this.present(displayedComponent.setDisplayStyle("overlay"));

        setTimeout(() => {
            displayedComponent.vnode?.componentInstance?.$parent?.$emit("pop");
        }, 1000);
    }

    async validate() {
        if (!this.webshop.domain) {
            await this.checkUriAvailability()
            if (!this.isAvailable) {
                throw new SimpleError({
                    code: "",
                    field: "uri",
                    message: "Kies een andere link, deze is ongeldig of al in gebruik."
                })
            }

            this.addPatch(PrivateWebshop.patch({ domainUri: null, domain: null }))
        } else {
            // Don't change the uri, because error handling could get weird if it is duplicate (the user won't notice it is changed)
            this.addPatch(PrivateWebshop.patch({ uri: this.originalWebshop.uri }))

            if (this.webshop.domainUri === null) {
                this.addPatch(PrivateWebshop.patch({ domainUri: "" }))
            }

            /// Check if URL format is okay
            try {
                const url = new URL('https://' + this.webshop.getDomainUrl())

                const hostname = url.hostname
                const parts = hostname.split(".")

                if (parts.length === 2) {
                    throw new SimpleError({
                        code: "",
                        field: "customUrl",
                        message: "Het is niet mogelijk om een hoofddomein te gebruiken voor een webshop. Lees de documentatie hierover na voor meer informatie."
                    })
                }
                const subdomain = parts[0]

                if (subdomain === 'inschrijven') {
                    throw new SimpleError({
                        code: "",
                        field: "customUrl",
                        message: "Het is momenteel niet mogelijk om 'inschrijven' te gebruiken als een subdomeinnaam voor jouw webshop. Deze is gereserveerd voor de ledenadministratie."
                    })
                }
            } catch (e) {
                if (isSimpleError(e) || isSimpleErrors(e)) {
                    throw e
                }
                throw new SimpleError({
                    code: "",
                    field: "customUrl",
                    message: "Deze domeinnaam is ongeldig."
                })
            }
        }
    }
}
</script>