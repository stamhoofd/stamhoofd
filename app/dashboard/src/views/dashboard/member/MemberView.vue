<template>
    <div class="st-view member-view">
        <STNavigationBar :title="member.details.name">
            <template #left>
                <button v-if="hasPreviousMember" class="button text" @click="goBack">
                    <span class="icon arrow-left" />
                    <span>Vorige</span>
                </button>
            </template>
            <template #right>
                <button v-if="hasNextMember" class="button text" @click="goNext">
                    <span>Volgende</span>
                    <span class="icon arrow-right" />
                </button>
                <button class="button icon close gray" @click="pop" />
            </template>
        </STNavigationBar>
        <STNavigationTitle>
            <span class="icon-spacer">{{ member.details.name }}</span>
            <MaleIcon v-if="member.details.gender == Gender.Male" class="icon-spacer" />
            <FemaleIcon v-if="member.details.gender == Gender.Female" class="icon-spacer" />
            <button class="button icon gray more" @click="showContextMenu" />
        </STNavigationTitle>

        <SegmentedControl v-model="tab" :items="tabs" :labels="tabLabels" v-if="payments.length > 0" />

        <main>
            <component :is="tab" :member="member" />
        </main>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { STNavigationTitle } from "@stamhoofd/components";
import { STNavigationBar } from "@stamhoofd/components";
import { FemaleIcon, MaleIcon, SegmentedControl } from "@stamhoofd/components";
import { Component, Mixins,Prop } from "vue-property-decorator";

import MemberContextMenu from "./MemberContextMenu.vue";
import MemberViewDetails from "./MemberViewDetails.vue";
import MemberViewHistory from "./MemberViewHistory.vue";
import MemberViewPayments from "./MemberViewPayments.vue";
import { MemberWithRegistrations, Gender } from '@stamhoofd/structures';

@Component({
    components: {
        STNavigationBar,
        STNavigationTitle,
        SegmentedControl,
        MaleIcon,
        FemaleIcon,
    },
})
export default class MemberView extends Mixins(NavigationMixin) {
    tabs = [MemberViewDetails, MemberViewPayments];
    tab = this.tabs[0];
    tabLabels = ["Steekkaart", "Betaling"];

    @Prop()
    member!: MemberWithRegistrations;

    @Prop()
    getNextMember!: (MemberWithRegistrations) => MemberWithRegistrations | null;

    @Prop()
    getPreviousMember!: (MemberWithRegistrations) => MemberWithRegistrations | null;

    created() {
        (this as any).Gender = Gender;
    }

    get hasNextMember(): boolean {
        return !!this.getNextMember(this.member);
    }

    get hasPreviousMember(): boolean {
        return !!this.getPreviousMember(this.member);
    }

    get payments() {
        return this.member.registrations.flatMap(r => r.payment ? [r.payment] : [])
    }

    goBack() {
        const member = this.getPreviousMember(this.member);
        if (!member) {
            return;
        }
        const component = new ComponentWithProperties(MemberView, {
            member: member,
            getNextMember: this.getNextMember,
            getPreviousMember: this.getPreviousMember,
        });
        this.navigationController?.push(component, true, 1, true);
    }

    goNext() {
        const member = this.getNextMember(this.member);
        if (!member) {
            return;
        }
        const component = new ComponentWithProperties(MemberView, {
            member: member,
            getNextMember: this.getNextMember,
            getPreviousMember: this.getPreviousMember,
        });
        this.navigationController?.push(component, true, 1, false);
    }

    activated() {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        document.addEventListener("keydown", this.onKey);
        console.log(this.member)
    }

    deactivated() {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        document.removeEventListener("keydown", this.onKey);
    }

    onKey(event) {
        if (event.defaultPrevented || event.repeat) {
            return;
        }

        const key = event.key || event.keyCode;

        if (key === "ArrowLeft" || key === "ArrowUp" || key === "PageUp") {
            this.goBack();
            event.preventDefault();
        } else if (key === "ArrowRight" || key === "ArrowDown" || key === "PageDown") {
            this.goNext();
            event.preventDefault();
        }
    }

    showContextMenu(event) {
        const displayedComponent = new ComponentWithProperties(MemberContextMenu, {
            x: event.clientX,
            y: event.clientY,
            member: this.member,
        });
        this.present(displayedComponent.setDisplayStyle("overlay"));
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.member-view {
    > main {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
    }
}
</style>
