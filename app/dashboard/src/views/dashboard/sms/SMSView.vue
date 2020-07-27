<template>
    <div class="st-view sms-view">
        <STNavigationBar title="SMS'en">
            <template #right>
                <button class="button icon gray clock">
                    Geschiedenis
                </button>
                <button class="button icon close" @click="pop" />
            </template>
        </STNavigationBar>
        <STNavigationTitle>
            <span class="icon-spacer">SMS'en</span>
        </STNavigationTitle>

        <main>
            <label class="style-label" for="sms-who">Naar wie?</label>
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

            <label class="style-label" for="sms-text">Bericht</label>
            <textarea id="sms-text" v-model="message" class="input" placeholder="Typ hier je SMS-bericht" />
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
                <button class="button primary" @click="send">
                    Versturen
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Member } from "@stamhoofd-frontend/models";
import { STNavigationTitle } from "@stamhoofd/components";
import { STToolbar } from "@stamhoofd/components";
import { STNavigationBar } from "@stamhoofd/components";
import { SegmentedControl } from "@stamhoofd/components";
import { Component, Mixins,Prop } from "vue-property-decorator";
import { MemberWithRegistrations } from '@stamhoofd/structures';

@Component({
    components: {
        STNavigationBar,
        STNavigationTitle,
        SegmentedControl,
        STToolbar,
    },
})
export default class SMSView extends Mixins(NavigationMixin) {
    @Prop()
    members!: MemberWithRegistrations[];

    @Prop({ default: "parents" })
    smsFilter!: string;

    message = "";

    getOS() {
        return "macOS";
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
            case "whatsapp":
                url = "https://wa.me/";
                break;
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
        padding-bottom: 20px;

        & > textarea {
            flex-grow: 1;
        }
    }
}
</style>
