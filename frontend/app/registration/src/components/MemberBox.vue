<template>
    <STListItem :selectable="canRegister" class="member-box smartphone-wrap left-center" :class="{ disabled: !canRegister}" @click="onClicked">
        <Checkbox v-if="canRegister" slot="left" :checked="selected" />
        <span v-else slot="left" class="icon canceled gray" />

        <h4 class="style-title-list ">
            {{ type == "member" ? member.name : group.settings.name }}
        </h4>
        <p v-if="!canRegister" class="style-description">
            {{ matchingError }}
        </p>
        <p v-else-if="!selected" class="style-description">
            <template v-if="item.waitingList">
                Klik om dit lid op de wachtlijst te zetten
            </template>
            <template v-else>
                Klik om dit lid in te schrijven
            </template>
        </p>
        <p v-else class="style-description">
            Ga door naar je mandje om te bevestigen
        </p>
        <p v-if="item.waitingList && canRegister">
            <span class="style-tag error">Inschrijven op wachtlijst</span>
        </p>

        <template slot="right">
            <button v-if="type == 'group'" class="button text" @click.stop="openGroup">
                <span class="icon info-filled" />
                <span>Meer info</span>
            </button>
        </template>
    </STListItem>
</template>


<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox,LoadingView, STList, STListItem, STNavigationBar, STToolbar, Toast } from "@stamhoofd/components"
import { MemberWithRegistrations, RegisterItem } from "@stamhoofd/structures";
import { Group } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { OrganizationManager } from "../../../dashboard/src/classes/OrganizationManager";
import { CheckoutManager } from "../classes/CheckoutManager";
import { MemberManager } from "../classes/MemberManager";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        LoadingView,
        Checkbox
    },
    filters: {
        price: Formatter.price
    }
})
export default class MemberBox extends Mixins(NavigationMixin){
    @Prop({ required: true })
    group: Group

    @Prop({ required: true })
    member: MemberWithRegistrations

    @Prop({ default: "member" })
    type: "group" | "member"

    CheckoutManager = CheckoutManager

    get canRegister() {
        return this.matchingError === null
    }

    get matchingError() {
       return this.member.getMatchingError(this.group, OrganizationManager.organization.meta.categories)

    }

    get imageSrc() {
        return (this.group.settings.squarePhoto ?? this.group.settings.coverPhoto)?.getPathForSize(100, 100)
    }

    get item() {
        // Waiting list or not?
        let waitingList = false
        if (this.group.hasWaitingList() && !this.member.canSkipWaitingList(this.group, (MemberManager.members ?? []).filter(m => m.id !== this.member.id))) {
            waitingList = true
        }
        console.log(waitingList)

        return new RegisterItem(this.member, this.group, { reduced: false, waitingList })
    }

    get selected() {
        return this.CheckoutManager.cart.hasItem(this.item)
    }

    openGroup() {
        // todo
    }

    onClicked() {
        if (!this.canRegister) {
            return;
        }

        if (this.selected) {
            this.CheckoutManager.cart.removeItem(this.item)
            //new Toast("Deze inschrijving is uit je mandje verwijderd", "trash red").setWithOffset().show()
        } else {
            this.CheckoutManager.cart.addItem(this.item)
            //new Toast("Deze inschrijving is aan je mandje toegevoegd", "success green").setWithOffset().show()
        }
        CheckoutManager.saveCart()
    }

}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.member-box {
    &.disabled {
        cursor: not-allowed;
    }

    img {
        width: 70px;
        height: 70px;
        border-radius: $border-radius;
        object-fit: cover;

        @media (min-width: 340px) {
            width: 80px;
            height: 80px;
        }

        @media (min-width: 801px) {
            width: 100px;
            height: 100px;
        }
    }
}
</style>