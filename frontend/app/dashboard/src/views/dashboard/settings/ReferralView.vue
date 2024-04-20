<template>
    <LoadingView v-if="loading || !status" />
    <div v-else id="referral-view" class="st-view background">
        <STNavigationBar title="Verdien tegoed" :dismiss="canDismiss" :pop="canPop" />

        <main>
            <h1 v-if="!status.invoiceValue">
                Geef {{status.value | price}}, krijg tot 100 euro tegoed* per vereniging
            </h1>
            <h1 v-else>
                Jouw doorverwijzingslink van {{status.value | price}}
            </h1>

            <p v-if="!status.invoiceValue">Ongetwijfeld ken je nog veel andere verenigingen (of ben je er ook in actief): een sportclub, school, jeugdbeweging... Als je andere verenigingen aanbrengt, en ze minimaal 1 euro besteden ontvang je zelf ook gratis tegoed. Per vereniging die je aanbrengt ontvang je telkens iets meer (zie tabel onderaan). Doe je het dus zorgvuldig en doordacht, dan kan je echt een hoop tegoed verzamelen zonder al te veel moeite.</p>

            <button class="button text" type="button" @click="showBilling">
                <span class="icon card" />
                <span>Toon mijn tegoed</span>
            </button>

            <Spinner v-if="loading" />
            <template v-if="!loading && status">
                <hr>
                <h2>Jouw doorverwijzingslink</h2>

                <input v-tooltip="'Klik om te kopiëren'" class="input" :value="href" readonly @click="copyElement">

                <p class="info-box">
                    Om andere verenigingen te motiveren om jouw link te gebruiken, krijgen ze zelf ook 25 euro tegoed. 
                </p>

                <STList>
                    <STListItem :selectable="true" @click="openFacebookShare">
                        <h2 class="style-title-list">
                            Delen op Facebook
                        </h2>
                        <span slot="left" class="icon share" />
                    </STListItem>
                    <STListItem v-if="canShare" :selectable="true" @click="share">
                        <h2 class="style-title-list">
                            Verstuur de link via SMS, e-mail, WhatsApp...
                        </h2>
                        <span slot="left" class="icon share" />
                    </STListItem>
                    <STListItem v-if="!isNative" :selectable="true" @click="downloadQR">
                        <h2 class="style-title-list">
                            Download de QR-code
                        </h2>
                        <p class="style-description-small">
                            Als je fysiek bij iemand bent, dan kan die deze QR-code scannen om de link te gebruiken. 
                        </p>
                        <span slot="left" class="icon qr-code" />
                    </STListItem>
                </STList>

                <template v-if="!status.invoiceValue">
                    <hr>
                    <h2>Overzicht van te verdienen tegoed</h2>
                    <p>Het bedrag dat je ontvangt stijgt per vereniging tot maximaal 100 euro per vereniging. Dus als je 6 verenigingen hebt aangebracht, verdien je in totaal € 210! Breng je er 10 aan, dan verdien je 550 euro.</p>

                    <STList>
                        <STListItem v-for="n in 9" :key="n">
                            {{ n }}e vereniging

                            <span slot="right" class="style-tag large">€ {{ n * 10 }}</span>
                            <span v-if="referredCount >= n" slot="left" class="icon star yellow" />
                            <span v-else slot="left" class="icon star-line light-gray" />
                        </STListItem>
                        <STListItem>
                            10e, 11e, 12e... vereniging

                            <span slot="right" class="style-tag large">€ 100</span>
                            <span v-if="referredCount >= 10" slot="left" class="icon star yellow" />
                            <span v-else slot="left" class="icon star-line light-gray" />
                        </STListItem>
                    </STList>            
                </template>    

                <hr>
                <h2>Geschiedenis</h2>
                <p>Hieronder kan je zien welke verenigingen jouw link hebben gebruikt.</p>

                <STList v-if="status.usedCodes.length > 0">
                    <STListItem v-for="used in status.usedCodes" :key="used.id" class="right-description">
                        <span v-if="used.creditValue !== null" slot="left" class="icon success green" />
                        <span v-else slot="left" class="icon clock gray" />
                        <h2 class="style-title-list">
                            {{ used.organizationName }}
                        </h2>
                        <p v-if="used.creditValue" class="style-description">
                            Je hebt jouw tegoed ontvangen!
                        </p>
                        <p v-else-if="used.creditValue !== null && status.invoiceValue" class="style-description">
                            Aangerekend in je openstaande saldo.
                        </p>
                        <p v-else-if="!status.invoiceValue" class="style-description">
                            Registreerde op {{ used.createdAt | date }}. Je ontvangt jouw tegoed zodra deze vereniging 1 euro heeft besteed.
                        </p>
                         <p v-else class="style-description">
                            Registreerde op {{ used.createdAt | date }}. Er werd nog niets aangekocht of gefactureerd.
                        </p>
                        <span v-if="used.creditValue" slot="right" class="style-tag large success">{{ used.creditValue | price }}</span>
                    </STListItem>
                </STList>
                
                <p v-else class="info-box">
                    Jouw link werd nog niet gebruikt
                </p>

                <hr v-if="!status.invoiceValue">
                <p class="style-description-small" v-if="!status.invoiceValue">
                    * We betalen het tegoed nooit uit. Je kan het enkel gebruiken om pakketten in Stamhoofd aan te kopen. Je kan je tegoed niet doorgeven aan een andere vereniging. Je kan geen tegoed krijgen voor een vereniging die al Stamhoofd gebruikt of al heeft geregistreerd. Ook als die persoon al een andere vereniging heeft op Stamhoofd kan je er geen tegoed meer voor krijgen. 
                    Tegoed vervalt als het één jaar lang niet gebruikt wordt (de geldigheid wordt telkens verlengd zodra er minstens 1 cent van gebruikt wordt). Je kan het tegoed niet gebruiken voor het betalen van transactiekosten van online betalingen.
                    Meerdere verenigingen zelf aanmaken om zo tegoed te krijgen is niet toegestaan.
                    Als het doorverwijzen gebeurt op een manier die als spam kan worden ervaren, kunnen we beslissen om het toekennen ongedaan te maken.
                </p>
            </template>
        </main>
    </div>
</template>

<script lang="ts">
import { Decoder } from "@simonbackx/simple-encoding";
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox, LoadingView, Spinner, STErrorsDefault, STInputBox, STList, STListItem, STNavigationBar, STToolbar, Toast, Tooltip, TooltipDirective } from "@stamhoofd/components";
import { AppManager, SessionManager, UrlHelper } from "@stamhoofd/networking";
import { OrganizationType, RegisterCodeStatus } from "@stamhoofd/structures";
import { Formatter, Sorter } from "@stamhoofd/utility";
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from "../../../classes/OrganizationManager";
import BillingSettingsView from "./packages/BillingSettingsView.vue";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        Checkbox,
        BackButton,
        STList,
        STListItem,
        Spinner,
        LoadingView
    },
    directives: {
        tooltip: TooltipDirective
    },
    filters: {
        price: Formatter.price.bind(Formatter),
        date: Formatter.date.bind(Formatter)
    }
})
export default class ReferralView extends Mixins(NavigationMixin) {
    loading = true;
    status: RegisterCodeStatus | null = null

    created() {
        this.loadCode().catch(console.error)
    }

    get isNative() {
        return AppManager.shared.isNative
    }

    get href() {
        return "https://"+STAMHOOFD.domains.dashboard+"/aansluiten?code="+encodeURIComponent(this.status?.code ?? "")+"&org="+encodeURIComponent(OrganizationManager.organization.name)
    }

    get isYouth() {
        return OrganizationManager.organization.meta.type === OrganizationType.Youth
    }

    get referralText() {
        return "Op zoek naar gemakkelijke ledenadministratie of wil je geld inzamelen via een webshop voor jouw vereniging? Wij gebruiken daarvoor Stamhoofd en we mogen 25 euro tegoed uitdelen aan alle verenigingen (sportclubs, jeugdbeweging, scholen, VZW's...) die zich op Stamhoofd registreren via onze link."
    }

    get referredCount() {
        return this.status?.usedCodes.reduce((c, code) => c + (code.creditValue !== null ? 1 : 0), 0) ?? 0
    }

    get canShare() {
        return !!navigator.share
    }

    share() {
        navigator.share({
            text: this.referralText,
            url: this.href,
        }).catch(e => console.error(e))
    }

    async downloadQR() {
        try {
            const QRCode = (await import(/* webpackChunkName: "QRCode" */ 'qrcode')).default
            const url = await QRCode.toDataURL(this.href, { scale: 10 })
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = "qr-code.png";
            anchor.click();
        } catch (e) {
            console.error(e)
            return;
        }
    }

    async loadCode() {
        this.loading = true;

        try {
            const response = await SessionManager.currentSession!.authenticatedServer.request({
                method: "GET",
                path: "/register-code",
                decoder: RegisterCodeStatus as Decoder<RegisterCodeStatus>
            })
            this.status = response.data
            this.status.usedCodes.sort((a, b) => Sorter.byDateValue(b.createdAt, a.createdAt))
        } catch (e) {
            console.error(e);
            Toast.fromError(e).show()
        }

        this.loading = false
    }
    
    mounted() {
        UrlHelper.setUrl("/settings/referrals");
    }

    openFacebookShare() {
        window.open("https://www.facebook.com/sharer/sharer.php?u=https://"+this.$t('shared.domains.marketing')+"&quote="+encodeURIComponent(this.referralText), "pop", "width=600, height=400, scrollbars=no");
    }

    showBilling() {
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(BillingSettingsView)
        }).setDisplayStyle("popup"))
    }

    copyElement(event) {
        event.target.contentEditable = true;

        document.execCommand('selectAll', false);
        document.execCommand('copy')

        event.target.contentEditable = false;

        const displayedComponent = new ComponentWithProperties(Tooltip, {
            text: "📋 Gekopieerd!",
            x: event.clientX,
            y: event.clientY + 10,
        });
        this.present(displayedComponent.setDisplayStyle("overlay"));

        setTimeout(() => {
            displayedComponent.vnode?.componentInstance?.$parent?.$emit("pop");
        }, 1000);
    }
}
</script>
