<template>
    <STListItem :selectable="true" class="member-box right-stack member-registration-block" @click="onClicked">
        <span v-if="type == 'member'" slot="left" class="icon user" />
        <template v-else slot="left">
            <figure v-if="imageSrc" class="registration-image">
                <img :src="imageSrc">
                <div>
                    <span v-if="waitingList" class="icon gray clock" />
                </div>
            </figure>
            <figure v-else class="registration-image">
                <figure>
                    <span>{{ group.settings.getShortCode(2) }}</span>
                </figure>
                <div>
                    <span v-if="waitingList" class="icon gray clock" />
                </div>
            </figure>
        </template>

        <h4 class="style-title-list ">
            {{ type == "member" ? member.name : group.settings.name }}
        </h4>

        <template slot="right">
            <span v-if="selected" class="style-tag">In mandje</span>
            <span v-if="canRegister.message" class="style-tag" :class="{ error: canRegister.closed, warn: canRegister.waitingList }">{{ canRegister.message }}</span>
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>


<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox, LoadingView, STList, STListItem, STNavigationBar, STToolbar, Toast } from "@stamhoofd/components";
import { Group, MemberWithRegistrations, RegisterItem } from "@stamhoofd/structures";
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

import CartView from "../../../webshop/src/views/checkout/CartView.vue";
import { CheckoutManager } from "../classes/CheckoutManager";
import { MemberManager } from "../classes/MemberManager";
import { OrganizationManager } from "../classes/OrganizationManager";
import GroupView from "../views/groups/GroupView.vue";

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
    Cart = CheckoutManager.cart

    get imageSrc() {
        return (this.group.settings.squarePhoto ?? this.group.settings.coverPhoto)?.getPathForSize(100, 100)
    }

    get canRegister() {
        return this.member.canRegister(this.group, MemberManager.members ?? [], OrganizationManager.organization.meta.categories, CheckoutManager.cart.items)
    }

    get item() {
        // Waiting list or not?
        return new RegisterItem(this.member, this.group, { reduced: false, waitingList: this.canRegister.waitingList })
    }

    get waitingList() {
        return this.canRegister.waitingList;
    }

    get selected() {
        return this.CheckoutManager.cart.hasItem(this.item)
    }

    openGroup() {
        this.show(new ComponentWithProperties(GroupView, {
            group: this.group,
            member: this.member
        }))
    }

    onClicked() {
        if (this.type === "group") {
            return this.openGroup()
        }
        
        throw new Error('Member type is deprecated. Always show group!')
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
    }

    .tag-box {
        padding-top: 5px;
    }
}
</style>