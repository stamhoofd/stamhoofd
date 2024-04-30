<template>
    <div class="st-view cart-view">
        <STNavigationBar :pop="canPop" :dismiss="canDismiss">
            <span v-if="cart.items.length > 0" slot="left" class="style-tag">{{ formatPrice(cart.price) }}</span>
        </STNavigationBar>

        <main class="flex">
            <h1>{{ title }}</h1>

            <p v-if="cart.price">
                Voeg alle inschrijvingen toe aan het mandje en reken in één keer af.
            </p>
            <p v-else>
                Voeg alle inschrijvingen toe aan het mandje en bevestig ze.
            </p>

            <p v-if="cart.isEmpty" class="info-box">
                Jouw mandje is leeg. Schrijf een lid in via het tabblad 'inschrijven'.
            </p>
            <STErrorsDefault :error-box="errorBox" />

            <STList>
                <STListItem v-for="item in cart.items" :key="item.id" class="cart-item-row" :selectable="true" @click="openGroup(item.group)">
                    <h3>
                        <span>{{ item.member.name }}</span>
                    </h3>
                    <p class="description">
                        {{ item.waitingList ? "Wachtlijst van " : "Inschrijven voor " }}{{ item.group.settings.name }}
                    </p>

                    <template #right><footer>
                        <p v-if="item.calculatedPrice" class="price">
                            {{ formatPrice(item.calculatedPrice) }}
                        </p>
                        <div @click.stop>
                            <button class="button icon trash gray" type="button" @click="deleteItem(item)" />
                        </div>
                    </footer></template>
                </STListItem>

                <STListItem v-for="item in cart.balanceItems" :key="item.id" class="cart-item-row">
                    <h3>
                        <span>{{ item.item.description }}</span>
                    </h3>
                    <p class="style-description-small">
                        Openstaand bedrag van {{ formatDate(item.item.createdAt) }}
                    </p>

                    <template #right><footer>
                        <p class="price">
                            {{ formatPrice(item.price) }}
                        </p>
                        <div @click.stop>
                            <button class="button icon trash gray" type="button" @click="deleteBalanceItem(item)" />
                        </div>
                    </footer></template>
                </STListItem>
            </STList>

            <template v-if="suggestedRegistrations.length">
                <hr>

                <h2>Suggesties</h2>
                <STList>
                    <STListItem v-for="suggestion in suggestedRegistrations" :key="suggestion.id" class="left-center hover-box member-registration-block" :selectable="true" @click="startRegistrationFlow(suggestion)">
                        <img v-if="!suggestion.group" slot="left" src="@stamhoofd/assets/images/illustrations/edit-data.svg" class="style-illustration-img">
                        <template v-else slot="left">
                            <figure v-if="suggestion.group.squareImage" class="registration-image">
                                <img :src="suggestion.group.squareImage.getPathForSize(100, 100)">
                                <div>
                                    <span v-if="suggestion.waitingList" class="icon gray clock" />
                                </div>
                            </figure>
                            <figure v-else class="registration-image">
                                <figure>
                                    <span>{{ suggestion.group.settings.getShortCode(2) }}</span>
                                </figure>
                                <div>
                                    <span v-if="suggestion.waitingList" class="icon gray clock" />
                                </div>
                            </figure>
                        </template>
                        <h3 class="style-title-list">
                            {{ suggestion.title }}
                        </h3>
                        <p v-if="suggestion.description" class="style-description-small">
                            {{ suggestion.description }}
                        </p>

                        <template #right><span class="icon arrow-right-small gray" /></template>
                    </STListItem>
                </STList>
            </template>

            <div v-if="(cart.items.length > 0 || cart.balanceItems.length) && (cart.administrationFee || cart.freeContribution)" class="pricing-box">
                <STList>
                    <STListItem v-if="cart.administrationFee || cart.freeContribution">
                        Subtotaal

                        <template #right>
                            {{ formatPrice(cart.priceWithoutFees) }}
                        </template>
                    </STListItem>

                    <STListItem v-if="cart.administrationFee">
                        Administratiekosten

                        <template #right>
                            {{ formatPrice(cart.administrationFee) }}
                        </template>
                    </STListItem>

                    <STListItem v-if="cart.freeContribution">
                        Vrije bijdrage

                        <template #right>
                            {{ formatPrice(cart.freeContribution) }}
                        </template>
                    </STListItem>

                    <STListItem>
                        Totaal

                        <template #right>
                            {{ formatPrice(cart.price) }}
                        </template> 
                    </STListItem>
                </STList>
            </div>
        </main>

        <STToolbar v-if="!cart.isEmpty">
            <template #left>
                <span>Totaal: {{ formatPrice(cart.price) }}</span>
            </template>

            <template #right>
                <button class="button secundary" type="button" @click="addItem">
                    <span class="icon add" />
                    <span>Inschrijving</span>
                </button>

                <LoadingButton :loading="loading">
                    <button class="button primary" type="button" @click="goToCheckout">
                        <span class="icon flag" />
                        <span v-if="cart.price">Afrekenen</span>
                        <span v-else>Bevestigen</span>
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>


<script lang="ts">
import { ComponentWithProperties, NavigationController, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { ErrorBox, LoadingButton, StepperInput, Steps,STErrorsDefault, STList, STListItem, STNavigationBar, STToolbar } from '@stamhoofd/components';
import { UrlHelper } from '@stamhoofd/networking';
import { BalanceItemCartItem, Group, RegisterItem } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Watch } from 'vue-property-decorator';

import { Suggestion, SuggestionBuilder } from '../../classes/SuggestionBuilder';
import GroupView from '../groups/GroupView.vue';
import ChooseMemberView from '../overview/register-flow/ChooseMemberView.vue';


@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        STErrorsDefault,
        LoadingButton,
        StepperInput
    },
    filters: {
        price: Formatter.price.bind(Formatter),
        priceChange: Formatter.priceChange.bind(Formatter),
        date: Formatter.date.bind(Formatter)
    }
})
export default class CartView extends Mixins(NavigationMixin){
    loading = false
    errorBox: ErrorBox | null = null

    get cart() {
        return this.$checkoutManager.cart
    }

    get title() {
        if (this.cart.balanceItems.length > 0) {
            return "Winkelmandje"
        }
        return "Inschrijvingsmandje"
    }

    addItem() {
        this.present({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(ChooseMemberView, {}),
                    fromCart: true
                })
            ],
            modalDisplayStyle: "popup"
        })
    }

    async goToCheckout() { 
        if (this.loading) {
            return
        }
        if (this.cart.isEmpty) {
            return
        }
        this.loading = true
        this.errorBox = null

        try {
            if (this.$organization.meta.recordsConfiguration.financialSupport) {
                // Go to financial view
                const component = (await import(/* webpackChunkName: "FinancialSupportView" */ './FinancialSupportView.vue')).default;
                this.show(
                    new ComponentWithProperties(Steps, { 
                        root: new ComponentWithProperties(component, {}),
                        totalSteps: this.$organization.meta.recordsConfiguration.freeContribution !== null ? 3 : 2
                    })
                );
            } else if(this.$organization.meta.recordsConfiguration.freeContribution !== null) {
                // Go to financial view
                const component = (await import(/* webpackChunkName: "FinancialSupportView" */ './FreeContributionView.vue')).default;
                this.show(
                    new ComponentWithProperties(Steps, { 
                        root: new ComponentWithProperties(component, {}),
                        totalSteps: 2
                    })
                );
            } else {
                // Go to financial view
                const component = (await import(/* webpackChunkName: "FinancialSupportView" */ './PaymentSelectionView.vue')).default;
                this.show(
                    new ComponentWithProperties(Steps, { 
                        root: new ComponentWithProperties(component, {}),
                        totalSteps: 1
                    })
                );
            }
        } catch (e) {
            console.error(e)
            this.recalculate().catch(console.error)
            this.errorBox = new ErrorBox(e)
        }
        this.loading = false
    }

    imageSrc(item: RegisterItem): string | null {
        return (item.group.settings.squarePhoto ?? item.group.settings.coverPhoto)?.getPathForSize(100, 100) ?? null
    }

    openGroup(group: Group) {
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(
                GroupView, {
                    group,
                    registerButton: false
                }
            )
        }).setDisplayStyle("popup"))
    }

    deleteItem(item: RegisterItem) {
        this.$checkoutManager.cart.removeItem(item)
        this.$checkoutManager.saveCart()
    }

    deleteBalanceItem(item: BalanceItemCartItem) {
        this.$checkoutManager.cart.removeBalanceItem(item)
        this.$checkoutManager.saveCart()
    }

    mounted() {
        UrlHelper.setUrl("/cart")

        this.recalculate().catch(e => {
            console.error(e)
        })
    }

    @Watch("cart.items")
    onCartChanged() {
        try {
            this.cart.calculatePrices(
                this.$memberManager.members ?? [], 
                this.$organization.groups, 
                this.$organization.meta.categories,
                this.$organization.meta.registrationPaymentConfiguration
            )
        } catch (e) {
            // error in calculation!
            console.error(e)
        }
        this.$checkoutManager.saveCart()
    }

    async recalculate() {
        try {
            await this.$checkoutManager.recalculateCart(
                // Refresh on every open of the cart, but not if last full refresh was less than 10 seconds ago
                this.$checkoutManager.isLastFullRefetchOld(10)
            )
            this.errorBox = null
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
        }
    }

    get members() {
        return this.$memberManager.members ?? []
    }

    get suggestedRegistrations(): Suggestion[] {
        return SuggestionBuilder.getSuggestions(this.$checkoutManager, this.members)
    }

    startRegistrationFlow(suggestion: Suggestion) {
        this.present({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: suggestion.getComponent(),
                    fromCart: true
                })
            ],
            modalDisplayStyle: "popup"
        })
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.cart-view {
    .cart-item-row {
        h3 {
            padding-top: 5px;
            @extend .style-title-3;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
        }

        .description {
            @extend .style-description-small;
            padding-top: 5px;
        }

        .price {
            font-size: 14px;
            line-height: 1.4;
            font-weight: 600;
            color: $color-primary;
        }

        footer {
            display: flex;
            justify-content: center;
            align-items: flex-end;
            gap: 15px;
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
}

</style>