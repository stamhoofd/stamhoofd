<template>
    <div class="st-view cart-view">
        <main class="limit-width">
            <section class="view">
                <STNavigationBar :title="title">
                    <span v-if="cart.items.length > 0" slot="left" class="style-tag">{{ cart.price | price }}</span>
                </STNavigationBar>

                <main>
                    <h1>{{ title }}</h1>

                    <p>Voeg alle inschrijvingen toe aan het mandje en reken in één keer af.</p>

                    <p v-if="cart.items.length == 0" class="info-box">
                        Jouw inschrijvings-mandje is leeg. Schrijf een lid in via het tabblad 'inschrijven'.
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
                                    <button class="button icon trash gray" @click="deleteItem(item)" />
                                </div>
                            </footer>

                            <figure v-if="imageSrc(item)" slot="right">
                                <img :src="imageSrc(item)">
                            </figure>
                        </STListItem>
                    </STList>
                </main>

                <STToolbar v-if="cart.items.length > 0">
                    <span slot="left">Totaal: {{ cart.price | price }}</span>
                    <LoadingButton slot="right" :loading="loading">
                        <button class="button primary" @click="goToCheckout">
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
import { ComponentWithProperties, HistoryManager, NavigationController, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { ErrorBox, LoadingButton,StepperInput,STErrorsDefault,STList, STListItem,STNavigationBar, STToolbar } from '@stamhoofd/components';
import { Group, RecordType, RegisterItem } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component } from 'vue-property-decorator';
import { Mixins } from 'vue-property-decorator';

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
            if (OrganizationManager.organization.meta.recordsConfiguration.shouldAsk(RecordType.FinancialProblems)) {
                // Go to financial view
                const component = (await import(/* webpackChunkName: "FinancialSupportView" */ './FinancialSupportView.vue')).default;
                this.present(
                    new ComponentWithProperties(NavigationController, { 
                        root: new ComponentWithProperties(component, {})
                    }).setDisplayStyle("popup")         
                );
            } else {
                // todo
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
            HistoryManager.setUrl("/cart")
        })

        this.recalculate()
    }

    recalculate() {
        try {
            this.cart.validate(MemberManager.members ?? [], OrganizationManager.organization.meta.categories)
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
    }

    mounted() {
        this.recalculate()
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