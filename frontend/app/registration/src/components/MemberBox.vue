<template>
    <STListItem :selectable="!canRegister.closed" class="member-box smartphone-wrap left-center" :class="{ disabled: !canRegister}" @click="onClicked">
        <Checkbox v-if="!canRegister.closed" slot="left" v-model="selected" @click.native.stop />
        <span v-else slot="left" class="icon canceled gray" />

        <h4 class="style-title-list ">
            {{ type == "member" ? member.name : group.settings.name }}
        </h4>

        <template v-if="!canRegister.closed">
            <p v-if="!selected" class="style-description">
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
        </template>
        
        <p v-if="type == 'group'">
            <button class="button text" @click.stop="openGroup">
                <span>Meer info</span>
            </button>
        </p>

        <template slot="right">
            <span v-if="canRegister.message" class="style-tag" :class="{ error: canRegister.closed, warn: canRegister.waitingList }">{{ canRegister.message }}</span>
        </template>
    </STListItem>
</template>


<script lang="ts">
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox,LoadingView, STList, STListItem, STNavigationBar, STToolbar, Toast } from "@stamhoofd/components"
import { AskRequirement, MemberWithRegistrations, RegisterItem } from "@stamhoofd/structures";
import { Group } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { CheckoutManager } from "../classes/CheckoutManager";
import { MemberManager } from "../classes/MemberManager";
import { OrganizationManager } from "../classes/OrganizationManager";
import GroupView from "../views/groups/GroupView.vue";
import { BuiltInEditMemberStep, EditMemberStep, EditMemberStepsManager, EditMemberStepType } from "../views/members/details/EditMemberStepsManager";

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

    get selected() {
        return this.CheckoutManager.cart.hasItem(this.item)
    }

    set selected(selected: boolean) {
        if (this.canRegister.closed) {
            this.CheckoutManager.cart.removeItem(this.item)
            CheckoutManager.saveCart()
            return
        }

        if (!selected) {
            this.CheckoutManager.cart.removeItem(this.item)
        } else {
            this.tryToSelect().catch(e => {
                console.error(e)
                Toast.fromError(e).show()
            })
        }
        CheckoutManager.saveCart()
    }

    openGroup() {
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(
                GroupView, {
                    group: this.group,
                    registerButton: false
                }
            )
        }).setDisplayStyle("popup"))
    }

    onClicked() {
        this.selected = !this.selected
    }

    doSelect() {
        if (!this.selected) {
            this.CheckoutManager.cart.addItem(this.item)
            CheckoutManager.saveCart()
        }
    }

    async tryToSelect() {
        // Only ask details + parents for new members

        const items = [...this.CheckoutManager.cart.items.filter(item => item.memberId === this.member.id), this.item]

        const stepManager = new EditMemberStepsManager(
            EditMemberStepsManager.getAllSteps(items, this.member, false), 
            items,
            this.member,
            (component: NavigationMixin) => {
                this.doSelect()
                component.dismiss({ force: true })
                return Promise.resolve()
            }
        )
        const component = await stepManager.getFirstComponent()

        if (!component) {
            // Everything skipped
            this.doSelect()
        } else {
            this.present(new ComponentWithProperties(NavigationController, {
                root: component
            }).setDisplayStyle("popup"))
        }
        
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

    .tag-box {
        padding-top: 5px;
    }
}
</style>