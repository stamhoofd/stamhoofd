<template>
    <div class="st-view cart-view">
        <main class="limit-width">
            <section class="view">
                <STNavigationBar :title="title" class="only-tab-bar">
                    <span v-if="cart.items.length > 0" slot="left" class="style-tag">{{ cart.price | price }}</span>
                </STNavigationBar>

                <main>
                    <h1>{{ title }}</h1>

                    <p>Voeg alle inschrijvingen toe aan het mandje en reken in één keer af.</p>

                    <p v-if="cart.items.length == 0" class="info-box">
                        Jouw mandje is leeg. Schrijf een lid in via het tabblad 'inschrijven'.
                    </p>
                    <STErrorsDefault :error-box="errorBox" />

                    <STList>
                        <STListItem v-for="item in cart.items" :key="item.id" class="cart-item-row" :selectable="true" @click="openGroup(item.group)">
                            <h3>
                                <span>{{ item.member.name }}</span>
                            </h3>
                            <p v-if="!item.waitingList" class="description">
                                {{ item.calculatedPrice | price }}
                            </p>

                            <footer>
                                <p class="price">
                                    {{ item.waitingList ? "Wachtlijst van " : "" }}{{ item.group.settings.name }}
                                </p>
                                <div @click.stop>
                                    <button class="button icon trash gray" type="button" @click="deleteItem(item)" />
                                </div>
                            </footer>

                            <figure v-if="imageSrc(item)" slot="right">
                                <img :src="imageSrc(item)">
                            </figure>
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
                </main>

                <STToolbar v-if="cart.items.length > 0" class="dont-float">
                    <span slot="left">Totaal: {{ cart.price | price }}</span>
                    <LoadingButton slot="right" :loading="loading">
                        <button class="button primary" type="button" @click="goToCheckout">
                            <span class="icon flag" />
                            <span>Afrekenen</span>
                        </button>
                    </LoadingButton>
                </STToolbar>
            </section>
        </main>
    </div>
</template>


<script lang="ts">
import { ComponentWithProperties, NavigationController, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { ErrorBox, LoadingButton, StepperInput, Steps, STErrorsDefault, STList, STListItem, STNavigationBar, STToolbar } from '@stamhoofd/components';
import { UrlHelper } from '@stamhoofd/networking';
import { Group, RegisterItem } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins } from 'vue-property-decorator';

import { CheckoutManager } from '../../classes/CheckoutManager';
import { MemberManager } from '../../classes/MemberManager';
import { OrganizationManager } from '../../classes/OrganizationManager';
import GroupView from '../groups/GroupView.vue';


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
        priceChange: Formatter.priceChange.bind(Formatter)
    }
})
export default class CartView extends Mixins(NavigationMixin){
    CheckoutManager = CheckoutManager

    title = "Inschrijvingsmandje"
    loading = false
    errorBox: ErrorBox | null = null

    get cart() {
        return this.CheckoutManager.cart
    }

    async goToCheckout() { 
        if (this.loading) {
            return
        }
        if (this.cart.items.length == 0) {
            return
        }
        this.loading = true
        this.errorBox = null

        try {
            // todo: go to checkout ;)
            if (OrganizationManager.organization.meta.recordsConfiguration.financialSupport && cart.price > 0) {
                // Go to financial view
                const component = (await import(/* webpackChunkName: "FinancialSupportView" */ './FinancialSupportView.vue')).default;
                this.present(
                    new ComponentWithProperties(Steps, { 
                        root: new ComponentWithProperties(component, {}),
                        totalSteps: OrganizationManager.organization.meta.recordsConfiguration.freeContribution !== null ? 3 : 2
                    })       
                );
            } else if(OrganizationManager.organization.meta.recordsConfiguration.freeContribution !== null) {
                // Go to financial view
                const component = (await import(/* webpackChunkName: "FinancialSupportView" */ './FreeContributionView.vue')).default;
                this.present(
                    new ComponentWithProperties(Steps, { 
                        root: new ComponentWithProperties(component, {}),
                        totalSteps: 2
                    })       
                );
            } else {
                // Go to financial view
                const component = (await import(/* webpackChunkName: "FinancialSupportView" */ './PaymentSelectionView.vue')).default;
                this.present(
                    new ComponentWithProperties(Steps, { 
                        root: new ComponentWithProperties(component, {}),
                        totalSteps: 1
                    })       
                );
            }

            await Promise.resolve()
        } catch (e) {
            console.error(e)
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

    deleteItem(RegisterItem: RegisterItem) {
        CheckoutManager.cart.removeItem(RegisterItem)
        CheckoutManager.saveCart()
    }

    activated() {
        console.log("set cart url")
        this.$nextTick(() => {
            UrlHelper.setUrl("/cart")
        })

        this.recalculate().catch(e => {
            console.error(e)
        })
    }

    async recalculate() {
        try {
            // Reload groups
            await OrganizationManager.reloadGroups()

            // Revalidate
            this.cart.validate(MemberManager.members ?? [], OrganizationManager.organization.groups, OrganizationManager.organization.meta.categories)
            this.errorBox = null
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
        }
        try {
            this.cart.calculatePrices(MemberManager.members ?? [], OrganizationManager.organization.groups, OrganizationManager.organization.meta.categories)
        } catch (e) {
            // error in calculation!
            console.error(e)
        }
        CheckoutManager.saveCart()
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
            justify-content: space-between;
            align-items: center;
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
