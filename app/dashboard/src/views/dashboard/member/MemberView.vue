<template>
    <div class="st-view member-view">
        <STNavigationBar :title="member.name">
            <template #left>
                <button v-if="hasPreviousMember" class="button icon gray arrow-left" @click="goBack">
                    Vorige
                </button>
            </template>
            <template #right>
                <button v-if="hasNextMember" class="button icon gray arrow-right" @click="goNext">
                    Volgende
                </button>
                <button class="button icon close" @click="pop" />
            </template>
        </STNavigationBar>
        <STNavigationTitle>
            <span class="icon-spacer">{{ member.name }}</span>
            <MaleIcon v-if="member.gender == Gender.Male" class="icon-spacer" />
            <FemaleIcon v-if="member.gender == Gender.Female" class="icon-spacer" />
            <button class="button more" @click="showContextMenu" />
        </STNavigationTitle>

        <SegmentedControl v-model="tab" :items="tabs" :labels="tabLabels" />

        <main>
            <component :is="tab" :member="member" />
        </main>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Gender } from "@stamhoofd-frontend/models";
import { Member } from "@stamhoofd-frontend/models";
import { STNavigationTitle } from "@stamhoofd/components";
import { STNavigationBar } from "@stamhoofd/components";
import { FemaleIcon, MaleIcon, SegmentedControl } from "@stamhoofd/components";
import { Component, Mixins,Prop } from "vue-property-decorator";

import MemberContextMenu from "./MemberContextMenu.vue";
import MemberViewDetails from "./MemberViewDetails.vue";
import MemberViewHistory from "./MemberViewHistory.vue";
import MemberViewPayments from "./MemberViewPayments.vue";

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
    tabs = [MemberViewDetails, MemberViewPayments, MemberViewHistory];
    tab = this.tabs[0];
    tabLabels = ["Steekkaart", "Betaling", "Geschiedenis"];

    @Prop()
    member!: Member;

    @Prop()
    getNextMember!: (Member) => Member | null;

    @Prop()
    getPreviousMember!: (Member) => Member | null;

    created() {
        (this as any).Gender = Gender;
    }

    get hasNextMember(): boolean {
        return !!this.getNextMember(this.member);
    }

    get hasPreviousMember(): boolean {
        return !!this.getPreviousMember(this.member);
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
