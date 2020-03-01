<template>
    <div class="st-view sms-view">
        <STNavigationBar title="SMS'en">
            <template v-slot:right>
                <button class="button icon gray clock">Geschiedenis</button>
                <button class="button icon close" @click="pop"></button>
            </template>
        </STNavigationBar>
        <STNavigationTitle>
            <span class="icon-spacer">SMS'en</span>
        </STNavigationTitle>

        <main>
            <label class="style-label" for="sms-who">Naar wie?</label>
            <select class="input" id="sms-who" v-model="smsFilter">
                <option value="parents">Enkel naar ouders</option>
                <option value="members">Enkel naar leden</option>
                <option value="all">Ouders en leden</option>
            </select>

            <label class="style-label" for="sms-text">Bericht</label>
            <textarea class="input" id="sms-text" placeholder="Typ hier je SMS-bericht" v-model="message"></textarea>
        </main>

        <STToolbar>
            <template v-slot:left>{{
                phones.length
                    ? phones.length > 1
                        ? phones.length + " ontvangers"
                        : "Eén ontvanger"
                    : "Geen ontvangers"
            }}</template>
            <template v-slot:right>
                <button class="button primary" @click="send">Versturen</button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Prop, Mixins } from "vue-property-decorator";

import { ComponentWithProperties } from "shared/classes/ComponentWithProperties";
import { NavigationMixin } from "shared/classes/NavigationMixin";
import Checkbox from "shared/components/inputs/Checkbox.vue";
import { Member } from "shared/models/Member";
import GroupListShort from "./GroupListShort.vue";
import NavigationController from "shared/components/layout/NavigationController.vue";
import STNavigationBar from "shared/components/navigation/STNavigationBar.vue";
import STNavigationTitle from "shared/components/navigation/STNavigationTitle.vue";
import SegmentedControl from "shared/components/inputs/SegmentedControl.vue";
import MemberViewDetails from "./MemberViewDetails.vue";
import MemberViewPayments from "./MemberViewPayments.vue";
import MemberViewHistory from "./MemberViewHistory.vue";
import MemberContextMenu from "./MemberContextMenu.vue";
import STToolbar from "shared/components/navigation/STToolbar.vue";

@Component({
    components: {
        STNavigationBar,
        STNavigationTitle,
        SegmentedControl,
        STToolbar
    }
})
export default class SMSView extends Mixins(NavigationMixin) {
    @Prop()
    members!: Member[];

    smsFilter = "parents";
    message = "";

    getOS() {
        return "macOS";
    }

    get phones(): string[] {
        return this.members.flatMap(member => {
            var arr = [];
            if (this.smsFilter == "parents" || this.smsFilter == "all") {
                arr = member.parents.flatMap(parent => {
                    if (parent.phone) {
                        return [parent.phone];
                    }
                    return [];
                });
            }

            if (member.phone && (this.smsFilter == "members" || this.smsFilter == "all")) {
                arr.push(member.phone);
            }
            return arr;
        });
    }

    send() {
        if (this.phones.length == 0) {
            return;
        }
        var url = "";
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

        // Add message
        /*if ($Mac) {
                            // werkt niet
                        } elseif ($Android) {
                            $url .= "?body=" . rawurlencode($data['message']);
                        } else {
                            $url .= "&body=" . rawurlencode($data['message']);
                        }*/
        if (this.getOS() == "whatsapp") {
            // Not working yet for multpile recipients
            url += this.phones.map(phone => phone.replace(/(\s|\+)+/g, "")).join(",");
        } else {
            url += this.phones.map(phone => phone.replace(/(\s)+/g, "")).join(",");
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
@use '~scss/layout/view.scss';

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
