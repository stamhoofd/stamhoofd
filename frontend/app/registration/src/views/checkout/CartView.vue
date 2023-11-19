<template>
    <div class="st-view cart-view">
        <STNavigationBar :pop="canPop" :dismiss="canDismiss">
            <span v-if="cart.items.length > 0" slot="left" class="style-tag">{{ cart.price | price }}</span>
        </STNavigationBar>

        <main>
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

                    <footer slot="right">
                        <p v-if="item.calculatedPrice" class="price">
                            {{ item.calculatedPrice | price }}
                        </p>
                        <div @click.stop>
                            <button class="button icon trash gray" type="button" @click="deleteItem(item)" />
                        </div>
                    </footer>
                </STListItem>

                <STListItem v-for="item in cart.balanceItems" :key="item.id" class="cart-item-row">
                    <h3>
                        <span>{{ item.item.description }}</span>
                    </h3>
                    <p class="style-description-small">
                        Openstaand bedrag van {{ item.item.createdAt | date }}
                    </p>

                    <footer slot="right">
                        <p class="price">
                            {{ item.price | price }}
                        </p>
                        <div @click.stop>
                            <button class="button icon trash gray" type="button" @click="deleteBalanceItem(item)" />
                        </div>
                    </footer>
                </STListItem>

                <STListItem v-if="cart.freeContribution > 0 && cart.items.length > 0">
                    <h3 class="style-title-list">
                        + Vrije bijdrage van {{ cart.freeContribution | price }}. Bedankt!
                    </h3>
                    <p class="style-description-small">
                        Je kan dit in één van de volgende stappen wijzigen
                    </p>
                </STListItem>
            </STList>

            <template v-if="suggestedRegistrations.length">
                <hr>

                <h2>Alles toegevoegd?</h2>
                <STList>
                    <STListItem v-for="suggestion in suggestedRegistrations" :key="suggestion.id" class="left-center hover-box member-registration-block" :selectable="true" @click="startRegistrationFlow(suggestion)">
                        <img v-if="!suggestion.group" slot="left" src="~@stamhoofd/assets/images/illustrations/edit-data.svg" class="style-illustration-img">
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

                        <span slot="right" class="icon arrow-right-small gray" />
                    </STListItem>
                </STList>
            </template>
        </main>

        <STToolbar v-if="!cart.isEmpty">
            <span slot="left">Totaal: {{ cart.price | price }}</span>

            <button slot="right" class="button secundary" type="button" @click="addItem">
                <span class="icon add" />
                <span>Inschrijving</span>
            </button>

            <LoadingButton slot="right" :loading="loading">
                <button class="button primary" type="button" @click="goToCheckout">
                    <span class="icon flag" />
                    <span v-if="cart.price">Afrekenen</span>
                    <span v-else>Bevestigen</span>
                </button>
            </LoadingButton>
        </STToolbar>
    </div>
</template>


<script lang="ts">
import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { ErrorBox, LoadingButton, StepperInput, Steps, STErrorsDefault, STList, STListItem, STNavigationBar, STToolbar } from '@stamhoofd/components';
import { SessionManager, UrlHelper } from '@stamhoofd/networking';
import { BalanceItemCartItem, Group, MemberBalanceItem, RegisterItem } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Watch } from 'vue-property-decorator';

import { CheckoutManager } from '../../classes/CheckoutManager';
import { MemberManager } from '../../classes/MemberManager';
import { OrganizationManager } from '../../classes/OrganizationManager';
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
    CheckoutManager = CheckoutManager

    loading = false
    errorBox: ErrorBox | null = null

    get cart() {
        return this.CheckoutManager.cart
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
            if (OrganizationManager.organization.meta.recordsConfiguration.financialSupport) {
                // Go to financial view
                const component = (await import(/* webpackChunkName: "FinancialSupportView" */ './FinancialSupportView.vue')).default;
                this.show(
                    new ComponentWithProperties(Steps, { 
                        root: new ComponentWithProperties(component, {}),
                        totalSteps: OrganizationManager.organization.meta.recordsConfiguration.freeContribution !== null ? 3 : 2
                    })
                );
            } else if(OrganizationManager.organization.meta.recordsConfiguration.freeContribution !== null) {
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
        CheckoutManager.cart.removeItem(item)
        CheckoutManager.saveCart()
    }

    deleteBalanceItem(item: BalanceItemCartItem) {
        CheckoutManager.cart.removeBalanceItem(item)
        CheckoutManager.saveCart()
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
            this.cart.calculatePrices(MemberManager.members ?? [], OrganizationManager.organization.groups, OrganizationManager.organization.meta.categories)
        } catch (e) {
            // error in calculation!
            console.error(e)
        }
        CheckoutManager.saveCart()
    }

    async recalculate() {
        try {
            await CheckoutManager.recalculateCart(
                // Refresh on every open of the cart, but not if last full refresh was less than 10 seconds ago
                CheckoutManager.isLastFullRefetchOld(10)
            )
            this.errorBox = null
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
        }
    }

    get members() {
        return MemberManager.members ?? []
    }

    get suggestedRegistrations(): Suggestion[] {
        return SuggestionBuilder.getSuggestions(this.members)
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