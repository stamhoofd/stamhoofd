<template>
    <div class="st-view group-view">
        <STNavigationBar :title="group.settings.name" :dismiss="canDismiss" :pop="canPop" />
        
        <main>
            <h1>
                <span>{{ group.settings.name }}</span>
                <GroupTag :group="group" />
            </h1>
            <figure v-if="coverPhotoSrc" class="cover-photo">
                <img :src="coverPhotoSrc">
            </figure>

            <p v-if="member && (itemCanRegister.description || itemCanRegister.message) && itemCanRegister.closed && !itemCanRegister.waitingList" class="error-box">
                {{ itemCanRegister.description || itemCanRegister.message }}
            </p>
            <p v-else-if="member && (itemCanRegister.description || itemCanRegister.message) && itemCanRegister.waitingList" class="warning-box">
                {{ itemCanRegister.description || itemCanRegister.message }}
            </p>
            <p v-else-if="member && (itemCanRegister.description || itemCanRegister.message) && itemCanRegister.invited" class="info-box icon email">
                {{ itemCanRegister.description || itemCanRegister.message }}
            </p>
            <template v-else>
                <p v-if="infoBox" class="info-box">
                    {{ infoBox }}
                </p>

                <p v-if="infoBox2" class="info-box">
                    {{ infoBox2 }}
                </p>

                <p v-if="!member && errorBox" class="error-box">
                    {{ errorBox }}
                </p>
            </template>

            <p v-if="group.settings.description" class="style-description pre-wrap" v-text="group.settings.description" />

            <STList class="group-info-list">
                <STListItem class="right-description">
                    Wanneer?

                    <template v-if="group.settings.displayStartEndTime" slot="right">
                        {{ formatDateTime(group.settings.startDate) }} - {{ formatDateTime(group.settings.endDate) }}
                    </template>
                    <template v-else slot="right">
                        {{ formatDate(group.settings.startDate) }} - {{ formatDate(group.settings.endDate) }}
                    </template>
                </STListItem>
                <STListItem v-if="group.settings.location" class="right-description">
                    Waar?

                    <template #right>
                        {{ group.settings.location }}
                    </template>
                </STListItem>
                <STListItem class="right-description wrap">
                    Wie?

                    <template #right><div v-text="who" /></template>
                </STListItem>

                <STListItem v-for="(price, index) of priceList" :key="index">
                    <h3>{{ price.text }}</h3>
                    <p class="style-description-small">
                        {{ price.description }}
                    </p>

                    <template #right><div class="style-description" v-text="price.price" /></template>
                </STListItem>
            </STList>
        </main>

        <STToolbar v-if="isSignedIn && registerButton && canRegister && member">
            <template #right><button class="primary button" type="button" @click="registerMember">
                <span>{{ member.firstName }} inschrijven</span>
                <span class="icon arrow-right" />
            </button></template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components";
import { SessionManager } from "@stamhoofd/networking";
import { Group, MemberWithRegistrations, RegisterItem, WaitingListType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";


import GroupTag from "../../components/GroupTag.vue";
import MemberBox from "../../components/MemberBox.vue";
import CartView from "../checkout/CartView.vue";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        Checkbox,
        BackButton,
        MemberBox,
        GroupTag
    },
    filters: {
        price: Formatter.price
    }
})
export default class GroupView extends Mixins(NavigationMixin){
    @Prop({ required: true })
        group!: Group

    /**
     * In case you want to add this member
     */
    @Prop({ required: false, default: null })
        member!: MemberWithRegistrations | null

    @Prop({ default: true })
        registerButton!: boolean

    
    SessionManager = SessionManager

    get members() {
        return this.$memberManager.members ?? []
    }

    get isSignedIn() {
        return this.$context && this.$context.isComplete()
    }

    get closed() {
        return this.group.closed
    }

    get canRegister() {
        if (!this.member) {
            return !!this.members.find((m) => {
                const r = m.canRegister(this.group, this.$memberManager.members ?? [], this.$organization.meta.categories, this.$checkoutManager.cart.items)
                return !r.closed || r.waitingList
            })
        }
        return !this.itemCanRegister.closed || this.itemCanRegister.waitingList
    }

    get now() {
        return new Date()
    }

    get itemCanRegister() {
        return this.member!.canRegister(this.group, this.$memberManager.members ?? [], this.$organization.meta.categories, this.$checkoutManager.cart.items)
    }

    registerMember() {
        if (!this.member) {
            return
        }
        const item = new RegisterItem(this.member, this.group, { reduced: false, waitingList: this.itemCanRegister.waitingList })
        this.$checkoutManager.startAddToCartFlow(this, item, (c: NavigationMixin) => {
            // If the cart is already visible, dismiss
            if (c.navigationController?.$attrs['fromCart']) {
                return c.dismiss({force: true})
            }

            // Else go to the cart directly and replace the navigation stack
            c.show({
                components: [
                    new ComponentWithProperties(CartView, {})
                ],
                replace: c.navigationController?.components?.length ?? 0
            })
        }).catch(console.error)
    }

    get coverPhotoSrc() {
        const image = this.group.settings.coverPhoto
        if (!image) {
            return null
        }
        return image.getPathForSize(1800, 750)
    }

    formatDateTime(date: Date) {
        return Formatter.dateTime(date)
    }

    formatDate(date: Date) {
        return Formatter.date(date)
    }

    get priceList() {
        const prices = this.group.settings.getGroupPrices(new Date())
        if (!prices) {
            return []
        }

        const list: { text: string, description: string, price: string }[] = []

        for (const [index, price] of prices.prices.entries()) {
            list.push({
                text: "Prijs",
                description: prices.prices.length > 1 ? (prices.sameMemberOnlyDiscount ? Formatter.capitalizeFirstLetter(Formatter.ordinalNumber(index + 1)+" inschrijving") : Formatter.capitalizeFirstLetter(Formatter.ordinalNumber(index + 1)+" gezinslid")): "",
                price: Formatter.price(price.price),
            })
        }

        for (const [index, price] of prices.prices.entries()) {
            if (price.reducedPrice !== null && price.reducedPrice !== price.price) {
                const text = prices.prices.length > 1 ? (prices.sameMemberOnlyDiscount ? Formatter.capitalizeFirstLetter("Verlaagd tarief voor "+Formatter.ordinalNumber(index + 1)+" inschrijving") : Formatter.capitalizeFirstLetter("Verlaagd tarief voor "+Formatter.ordinalNumber(index + 1)+" gezinslid")): "Verlaagd tarief"
                list.push({
                    text,
                    description: "Enkel voor gezinnen die in aanmerking komen voor financiële ondersteuning",
                    price: Formatter.price(price.reducedPrice),
                })
            }
        }

        return list
    }

    get infoBox() {
        if (this.group.settings.registrationStartDate && this.group.settings.registrationStartDate > this.now) {
            if (this.group.activePreRegistrationDate) {
                if (this.group.settings.priorityForFamily) {
                    return "De inschrijvingen gaan open op " + Formatter.dateTime(this.group.settings.registrationStartDate, true)
                        + ". Bestaande leden en broers/zussen kunnen al inschrijven vanaf " + Formatter.dateTime(this.group.settings.preRegistrationsDate!, true) + "."
                }
                return "De inschrijvingen gaan open op " + Formatter.dateTime(this.group.settings.registrationStartDate, true)
                        + ". Bestaande leden kunnen al inschrijven vanaf " + Formatter.dateTime(this.group.settings.preRegistrationsDate!, true) + "."
            }
            return "De inschrijvingen gaan open op "+ Formatter.dateTime(this.group.settings.registrationStartDate, true)
        }

        return null;
    }

    get infoBox2() {
        if ((this.group.settings.registrationEndDate && this.group.settings.registrationEndDate < this.now) || this.group.settings.isFull) {
            return null
        }

        if (this.group.settings.waitingListType === WaitingListType.ExistingMembersFirst) {
            if (this.group.settings.priorityForFamily) {
                return "Bestaande leden en broers en zussen kunnen meteen inschrijven. Nieuwe leden komen eerst op de wachtlijst terecht en kunnen later worden toegelaten."
            }
            return "Bestaande leden kunnen meteen inschrijven. Nieuwe leden komen eerst op de wachtlijst terecht en kunnen later worden toegelaten."
        }

        if (this.group.settings.waitingListType === WaitingListType.All) {
            return "Iedereen moet inschrijven op de wachtlijst"
        }
        

        return null;
    }

    get errorBox() {
        if (this.group.settings.registrationEndDate && this.group.settings.registrationEndDate < this.now) {
            return "De inschrijvingen zijn afgelopen"
        }

        if (this.closed) {
            return "De inschrijvingen zijn gesloten"
        }

        if (this.group.settings.isFull && !this.canRegister) {
            // Check if still possible
            if (this.group.settings.waitingListIfFull) {
                return "Helaas al volzet! Je kan enkel nog op de wachtlijst inschrijven."
            }
            return "Helaas al volzet!"
        }
        return null;
    }

    get who() {
        let who = this.group.settings.getAgeGenderDescription({includeAge: true, includeGender: true}) ?? '';
        

        if (this.group.settings.requireGroupIds.length > 0) {
            const prefix = Formatter.joinLast(this.group.settings.requireGroupIds.map(id => this.$organization.groups.find(g => g.id == id)?.settings.name ?? "Onbekend"), ", ", " of ")
            if (!who) {
                who += prefix
            } else {
                who = prefix + "\n" + who
            }
        }

        if (this.group.settings.preventPreviousGroupIds.length > 0) {
            const prefix = "Iedereen die de vorige keer niet ingeschreven was bij "+Formatter.joinLast(this.group.settings.preventPreviousGroupIds.map(id => this.$organization.groups.find(g => g.id == id)?.settings.name ?? "Onbekend"), ", ", " of ")
            if (!who) {
                who += prefix
            } else {
                who = prefix + "\n" + who
            }
        }

        if (this.group.settings.requirePreviousGroupIds.length > 0) {
            const prefix = "Iedereen die de vorige keer ingeschreven was bij "+Formatter.joinLast(this.group.settings.requirePreviousGroupIds.map(id => this.$organization.groups.find(g => g.id == id)?.settings.name ?? "Onbekend"), ", ", " of ")
            if (!who) {
                who += prefix
            } else {
                who = prefix + "\n" + who
            }
        }

        if (!who) {
            return "Iedereen kan inschrijven"
        }

        return who;
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.group-view {
    .cover-photo {
        height: 0;
        position: relative;
        padding-bottom: calc(750 / 1800 * 100%);
        background: $color-gray-3;
        border-radius: $border-radius;
        margin-bottom: 20px;

        img {
            border-radius: $border-radius;
            height: 100%;
            width: 100%;
            object-fit: cover;
            position: absolute;
            left: 0;
            top: 0;
        }
    }

    p + .group-info-list {
        margin-top: 20px;
    }
}
</style>