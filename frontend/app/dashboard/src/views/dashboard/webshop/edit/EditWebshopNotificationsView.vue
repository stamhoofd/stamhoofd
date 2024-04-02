<template>
    <SaveView :title="viewTitle" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>{{ viewTitle }}</h1>
        <p>Voeg e-mailadressen toe waarop je automatisch een e-mail wilt ontvangen als er nieuwe bestellingen binnen komen. Gebruik deze functie alleen als je geen grote aantallen bestellingen per dag verwacht.</p>

        <STErrorsDefault :error-box="errorBox" />

        <EmailInput v-for="n in emailCount" :key="n" :title="'E-mailadres '+n" :value="getEmail(n - 1)" placeholder="E-mailadres" :validator="validator" @input="setEmail(n - 1, $event)">
            <span v-if="isBlocked(n-1)" slot="right" v-tooltip="getInvalidEmailDescription(n-1)" class="icon warning yellow" />
            <button slot="right" class="button icon trash gray" type="button" @click="deleteEmail(n - 1)" />
        </EmailInput>

        <p v-if="emailCount == 0" class="info-box">
            Er zijn nog geen e-mailadressen ingesteld die een e-mail ontvangen bij nieuwe bestellingen.
        </p>

        <button v-for="suggestion in suggestions" :key="suggestion" class="button text" type="button" @click="addEmail(suggestion)">
            <span class="icon add" />
            <span>{{ suggestion }}</span>
        </button>

        <button class="button text" type="button" @click="addEmail('')">
            <span class="icon add" />
            <span>Ander e-mailadres</span>
        </button>
    </SaveView>
</template>

<script lang="ts">
import { ArrayDecoder, Decoder } from "@simonbackx/simple-encoding";
import { Request } from "@simonbackx/simple-networking";
import { EmailInput, SaveView, STErrorsDefault, STInputBox, TooltipDirective } from "@stamhoofd/components";
import { SessionManager, UrlHelper } from "@stamhoofd/networking";
import { EmailInformation, PrivateWebshop, WebshopPrivateMetaData } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from "../../../../classes/OrganizationManager";
import EditWebshopMixin from "./EditWebshopMixin";


@Component({
    components: {
        STInputBox,
        STErrorsDefault,
        SaveView,
        EmailInput,
    },
    directives: {
        tooltip: TooltipDirective
    }
})
export default class EditWebshopNotificationsView extends Mixins(EditWebshopMixin) {
    get organization() {
        return OrganizationManager.organization
    }

    get user() {
        return OrganizationManager.user
    }

    get viewTitle() {
        return "Meldingen"
    }

    beforeDestroy() {
        Request.cancelAll(this)
    }

    get emails() {
        return this.webshop.privateMeta.notificationEmails
    }

    getEmail(n: number) {
        return this.emails[n]
    }

    mounted() {
        UrlHelper.setUrl("/webshops/" + Formatter.slug(this.webshop.meta.name) + "/settings/notifications")
        this.checkBounces().catch(console.error)
    }

    setEmail(n: number, email: string) {
        const notificationEmails = this.emails.slice();
        notificationEmails[n] = email;
        this.addPatch(PrivateWebshop.patch({ 
            privateMeta: WebshopPrivateMetaData.patch({
                notificationEmails: notificationEmails as any
            })
        }))
    }

    deleteEmail(n: number) {
        const notificationEmails = this.emails.slice();
        notificationEmails.splice(n, 1)
        this.addPatch(PrivateWebshop.patch({ 
            privateMeta: WebshopPrivateMetaData.patch({
                notificationEmails: notificationEmails as any
            })
        }))
    }

    addEmail(str: string) {
        const notificationEmails = this.emails.slice();
        notificationEmails.push(str);
        this.addPatch(PrivateWebshop.patch({ 
            privateMeta: WebshopPrivateMetaData.patch({
                notificationEmails: notificationEmails as any
            })
        }))
    }

    isBlocked(n: number) {
        const email = this.getEmail(n);
        return this.emailInformation.find(e => e.email === email && (e.markedAsSpam || e.hardBounce || e.unsubscribedAll))
    }

    getInvalidEmailDescription(n: number) {
        const email = this.getEmail(n);
        const find = this.emailInformation.find(e => e.email === email)
        if (!find) {
            return null
        }
        if (find.unsubscribedAll) {
            return "Heeft zich uitgeschreven voor e-mails"
        }
        if (find.markedAsSpam) {
            return "Heeft e-mail als spam gemarkeerd"
        }
        if (find.hardBounce) {
            return "Ongeldig e-mailadres"
        }
        return null
    }

    checkingBounces = false;
    emailInformation: EmailInformation[] = []

    async checkBounces() {
        if (this.checkingBounces) {
            return
        }
        this.checkingBounces = true

        try {
            const response = await SessionManager.currentSession!.authenticatedServer.request({
                method: "POST",
                path: "/email/check-bounces",
                body: this.emails,
                decoder: new ArrayDecoder(EmailInformation as Decoder<EmailInformation>)
            })
            this.emailInformation = response.data
        } catch (e) {
            console.error(e)
        }
        this.checkingBounces = false
    }

    get suggestions() {
        return [this.user.email].filter(e => !this.emails.includes(e))
    }

    get emailCount() {
        return this.emails.length;
    }
}
</script>