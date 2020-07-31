<template>
    <div class="st-view sms-view">
        <STNavigationBar title="SMS'en">
            <template #right>
                <button class="button icon close gray" @click="dismiss" />
            </template>
        </STNavigationBar>
        <STNavigationTitle>
            <span class="icon-spacer">SMS'en</span>
        </STNavigationTitle>

        <main>
            <div class="error-box" v-if="!isSupported">SMS functionaliteit is niet beschikbaar op dit toestel. Probeer het op een smartphone of Mac.</div>
            <STInputBox title="Naar wie?">
                <select id="sms-who" v-model="smsFilter" class="input">
                    <option value="parents">
                        Enkel naar ouders
                    </option>
                    <option value="members">
                        Enkel naar leden
                    </option>
                    <option value="all">
                        Ouders en leden
                    </option>
                </select>
            </STInputBox>

            <STInputBox title="Bericht" id="message-title" v-if="canUseBody" />
            <textarea id="sms-text" v-model="message" class="input" placeholder="Typ hier je SMS-bericht" v-if="canUseBody" />
        </main>

        <STToolbar>
            <template #left>
                {{
                    phones.length
                        ? phones.length > 1
                            ? phones.length + " ontvangers"
                            : "Eén ontvanger"
                        : "Geen ontvangers"
                }}
            </template>
            <template #right>
                <button class="button primary" @click="send" :disabled="!isSupported || phones.length == 0">
                    Versturen
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STNavigationTitle } from "@stamhoofd/components";
import { STToolbar, STInputBox } from "@stamhoofd/components";
import { STNavigationBar } from "@stamhoofd/components";
import { SegmentedControl } from "@stamhoofd/components";
import { Component, Mixins,Prop } from "vue-property-decorator";
import { MemberWithRegistrations } from '@stamhoofd/structures';

@Component({
    components: {
        STNavigationBar,
        STNavigationTitle,
        SegmentedControl,
        STInputBox,
        STToolbar,
    },
})
export default class SMSView extends Mixins(NavigationMixin) {
    @Prop()
    members!: MemberWithRegistrations[];

    @Prop({ default: "parents" })
    initialSmsFilter!: string;
    smsFilter = this.initialSmsFilter

    message = "";

    get isSupported() {
        return this.getOS() != "unknown" && this.getOS() != "windows"
    }

    get canUseBody() {
        return this.getOS() != "unknown" && this.getOS() != "windows" && this.getOS() != "macOS-old"
    }

    getOS(): string {
        var userAgent = navigator.userAgent || navigator.vendor;

        if (/android/i.test(userAgent)) {
            return "android";
        }

        if (/Mac OS X 10_14|Mac OS X 10_13|Mac OS X 10_12|Mac OS X 10_11|Mac OS X 10_10|Mac OS X 10_9/.test(userAgent)) {
            // Different sms protocol
            return "macOS-old";
        }

        // iOS detection from: http://stackoverflow.com/a/9039885/177710
        if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
            return "iOS";
        }

        // iPad on iOS 13 detection
        if (navigator.userAgent.includes("Mac") && "ontouchend" in document) {
            return "iOS";
        }

        if (navigator.platform.toUpperCase().indexOf('MAC')>=0 ) {
            return "macOS";
        }

        if (navigator.platform.toUpperCase().indexOf('WIN')>=0 ) {
            return "windows";
        }

        if (navigator.platform.toUpperCase().indexOf('IPHONE')>=0 ) {
            return "iOS";
        }

        if (navigator.platform.toUpperCase().indexOf('ANDROID')>=0 ) {
            return "android";
        }

        return "unknown"
    }

    get phones(): string[] {
        return this.members.flatMap((member) => {
            if (!member.details) {
                return []
            }
            let arr: string[] = [];
            if (this.smsFilter == "parents" || this.smsFilter == "all") {
                arr = member.details.parents.flatMap((parent) => {
                    if (parent.phone) {
                        return [parent.phone];
                    }
                    return [];
                });
            }

            if (member.details.phone && (this.smsFilter == "members" || this.smsFilter == "all")) {
                arr.push(member.details.phone);
            }
            return arr;
        });
    }

    send() {
        if (this.phones.length == 0) {
            return;
        }
        let url = "";
        switch (this.getOS()) {
            case "macOS-old":
                url = "imessage:";
                break;
            case "android":
                url = "sms:";
                break;
            /*case "whatsapp":
                url = "https://wa.me/";
                break;*/
            case "macOS":
            case "iOS":
                url = "sms:/open?addresses=";
                break;
        }

        if (this.getOS() == "whatsapp") {
            // Not working yet for multpile recipients
            url += this.phones.map((phone) => phone.replace(/(\s|\+)+/g, "")).join(",");
        } else {
            url += this.phones.map((phone) => phone.replace(/(\s)+/g, "")).join(",");
        }

        switch (this.getOS()) {
            case "macOS-old":
                // werkt niet
                break;
            case "android":
                url += "?body=" + encodeURIComponent(this.message);
                break;
            case "whatsapp":
                url += "?text=" + encodeURIComponent(this.message);
                break;
            case "macOS":
            case "iOS":
                url += "&body=" + encodeURIComponent(this.message);
                break;
        }

        window.location.href = url;
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.sms-view {
    > main {
        display: flex;
        flex-grow: 1;
        flex-direction: column;

        #message-title {
            padding-bottom: 0;
        }

        & > textarea {
            flex-grow: 1;
            min-height: 200px;
        }
    }
}
</style>
