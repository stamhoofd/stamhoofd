<template>
    <div id="send-invite-view" class="st-view" :class="{ 'android-icons': isAndroid }">
        <STNavigationBar title="Gelukt!">
            <button v-if="canDismiss" slot="right" class="button icon close gray" @click="dismiss" />
        </STNavigationBar>

        <main>
            <h1>
                Verstuur de uitnodiging
            </h1>
        
            <p class="st-list-description">
                Stuur de onderstaande link persoonlijk naar {{ name }} via een veilig kanaal (bv. WhatsApp, iMessage...). 
                <template v-if="invite.userDetails && invite.userDetails.email">
                    De link is 7 dagen geldig.
                </template>
                <template v-else>
                    De link is 4 uur geldig.
                </template>
            </p>

            <STInputBox title="Link" class="max">
                <p v-tooltip="'Klik om te kopiëren'" class="link-box input" @click="copyElement">
                    {{ url }}
                </p>
            </STInputBox>


            <hr>
            <h2>Of laat {{ name }} deze QR-code scannen</h2>
            <p class="st-list-description">
                Zijn jullie fysiek bij elkaar? Laat {{ name }} dan de QR-code onderaan scannen.
            </p>

            <img v-if="QRCodeUrl" :src="QRCodeUrl" class="qr-code">
        </main>

        <STToolbar v-if="canShare">
            <template slot="right">
                <button class="button primary" @click="share">
                    <span class="icon share" />
                    <span>Verstuur via...</span>
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, Decoder,PartialWithoutMethods, PatchType } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox,ErrorBox, LoadingButton, STErrorsDefault,STInputBox, STNavigationBar, STToolbar, Tooltip,TooltipDirective } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { Address, DNSRecord, Group, GroupGenderType, GroupPatch, GroupSettings, GroupSettingsPatch, Invite,Organization, OrganizationPatch } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";

import { OrganizationManager } from "../../../classes/OrganizationManager"

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        Checkbox,
        BackButton,
        LoadingButton
    },
    directives: {
        tooltip: TooltipDirective
    }
})
export default class SendInviteView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    invite!: Invite

    @Prop({ required: true })
    secret!: string

    QRCodeUrl: string | null = null

    get isAndroid() {
        const userAgent = navigator.userAgent || navigator.vendor;

        if (/android/i.test(userAgent)) {
            return true;
        }
        return false;
    }

    get name() {
        return this.invite.userDetails?.firstName ?? "deze persoon"
    }

    get url() {
        if (process.env.NODE_ENV == "production") {
            return "https://stamhoofd.app/invite?secret="+encodeURIComponent(this.secret)+"&key="+encodeURIComponent(this.invite.key)
        }
        return "https://dashboard.stamhoofd.dev/invite?secret="+encodeURIComponent(this.secret)+"&key="+encodeURIComponent(this.invite.key)
    }

    get canShare() {
        return !!navigator.share
    }

    share() {
        navigator.share({
            title: "Uitnodiging voor Stamhoofd",
            text: "Registreer je binnen het uur via deze link.",
            url: this.url,
        })
    }

    mounted() {
        this.generateQRCode()
    }

    async generateQRCode() {
         try {
            const QRCode = (await import(/* webpackChunkName: "QRCode" */ 'qrcode')).default
            this.QRCodeUrl = await QRCode.toDataURL(this.url, { margin: 0 })
        } catch (e) {
            console.error(e)
            return;
        }
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
@use "@stamhoofd/scss/base/text-styles.scss" as *;

#send-invite-view {
    .link-box {
        overflow-x: auto;
        text-overflow: visible;
    }

    .qr-code {
        max-width: 100%;
        padding: 15px 0;
    }
}
</style>
