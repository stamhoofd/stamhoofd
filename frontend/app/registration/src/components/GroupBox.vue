<template>
    <article class="group-box" :class="{selected: selectedCount > 0}" @click="onClicked">
        <div class="left" />
        <div class="content">
            <div>
                <h3>
                    <div class="counter">
                        {{ selectedCount }} x
                    </div>
                    {{ group.settings.name }}
                </h3>
                <p v-if="group.settings.description" class="description" v-text="group.settings.description" />
                <p class="price">
                    <span v-if="group.notYetOpen" class="style-tag error">Nog niet geopend</span>
                    <span v-else-if="group.closed" class="style-tag error">Gesloten</span>
                    <template v-else-if="group.settings.registeredMembers !== null && group.settings.maxMembers !== null">
                        <span v-if="group.settings.maxMembers - group.settings.registeredMembers > 0" class="style-tag warn">
                            Nog {{ group.settings.maxMembers - group.settings.registeredMembers }} {{ group.settings.maxMembers - group.settings.registeredMembers != 1 ? 'plaatsen' : 'plaats' }}
                        </span>
                        <span v-else-if="waitingListIfFull" class="style-tag warn">
                            Wachtlijst
                        </span>
                        <span v-else class="style-tag error">
                            Volzet
                        </span>
                        <span v-else-if="preRegistrations" class="style-tag warn">Voorinschrijvingen</span>
                    </template>
                    <span v-else-if="preRegistrations" class="style-tag warn">Voorinschrijvingen</span>
                    <span v-else-if="allWaitingList" class="style-tag error">Wachtlijst</span>
                </p>
            </div>
            <hr>
        </div>
        <figure v-if="imageSrc">
            <img :src="imageSrc">
        </figure>
    </article>
</template>


<script lang="ts">
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox,LoadingView, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components"
import { Group, WaitingListType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { CheckoutManager } from "../classes/CheckoutManager";
import GroupMemberSelectionView from "../views/groups/GroupMemberSelectionView.vue";
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
export default class GroupBox extends Mixins(NavigationMixin){
    @Prop({ required: true })
    group: Group

    CheckoutManager = CheckoutManager
    
    
    get imageSrc() {
        return (this.group.settings.squarePhoto ?? this.group.settings.coverPhoto)?.getPathForSize(100, 100)
    }

    get minimumPrice(): number | null {
        const prices = this.group.settings.getGroupPrices(new Date())
        const nums: number[] = [
            prices?.familyPrice,
            prices?.extraFamilyPrice,
            prices?.reducedPrice
        ].filter(p => p !== undefined && p !== null) as number[]

        if (nums.length === 0) {
            return null
        }

        return Math.min(...nums)
    }

    get getRegistrationInfo() {
        return this.group
    }

    get selectedCount() {
        return CheckoutManager.cart.items.filter(i => i.group.id === this.group.id).length
    }

    get price() {
        return this.group.settings.getGroupPrices(new Date())?.price ?? 0
    }

    get preRegistrations() {
        return this.group.activePreRegistrationDate !== null
    }

    get waitingListIfFull() {
        return this.group.hasWaitingList()
    }

    get allWaitingList() {
        return this.group.settings.waitingListType === WaitingListType.All
    }

    get newWaitingList() {
        return this.group.settings.waitingListType === WaitingListType.ExistingMembersFirst
    }

    onClicked() {
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(GroupView, {
                group: this.group
            })
        }).setDisplayStyle("popup"))
        //this.show(new ComponentWithProperties(GroupView, { group: this.group }))
    }

}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.group-box {
    

    display: flex;
    flex-direction: row;
    align-items: center;
    overflow: hidden;

    cursor: pointer;
    touch-action: manipulation;
    -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
    user-select: none;
    transition: background-color 0.2s 0.1s;

    margin: 0 calc(-1 * var(--st-horizontal-padding, 40px));

    > .content > hr {
        border: 0;
        outline: 0;
        height: $border-width;
        width: 100%;
        background: var(--color-current-border, #{$color-border});
        border-radius: $border-width/2;
        margin: 0;
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
    }

    &:last-child {
        > .content > hr {
            display: none;
        }
    }

    //@media (min-width: 801px) {
        background: $color-white;
        border-radius: $border-radius;
        margin: 0;
        @include style-side-view-shadow();

        > .content > hr {
            display: none;
        }
    //}

    &:active {
        transition: none;
        background: $color-background-shade;
        background: var(--color-current-background-shade, $color-background-shade);
    }

    > .left {
        overflow: hidden;
        width: 4px;
        flex-shrink: 0;
        background: $color-primary;
        align-self: stretch;
        border-radius: $border-radius;
        opacity: 0;
        transform: translateX(-4px);
        transition: opacity 0.2s, transform 0.2s;
    }

    &.selected {
        > .left {
            opacity: 1;
            transform: translateX(0);
        }
    }

    > .content {
        flex-grow: 1;
        min-width: 0;
        align-self: stretch;
        display: flex;
        align-items: center;
        position: relative;

        > div {
            padding: 15px;
            padding-left: var(--st-horizontal-padding, 15px);
            padding-right: var(--st-horizontal-padding, 15px);

            @media (min-width: 801px) {
                padding: 15px;
            }

            flex-grow: 1;
            min-width: 0;

            > h3 {
                padding-top: 5px;
                @extend .style-title-3;
                padding-right: 30px;
                position: relative;
                transition: transform 0.2s;

                > .counter {
                    position: absolute;
                    left: 0;
                    opacity: 0;
                    width: 30px;

                    font-size: 14px;
                    line-height: 1.4;
                    font-weight: 600;
                    color: $color-primary;

                    transform: translateX(-30px);
                    transition: opacity 0.2s;
                }
            }

            > .description {
                @extend .style-description-small;
                padding-top: 5px;
                text-overflow: ellipsis;
                overflow: hidden;
                display: -webkit-box;
                white-space: pre-wrap;
                line-clamp: 2; /* number of lines to show */
                -webkit-line-clamp: 2; /* number of lines to show */
                -webkit-box-orient: vertical;
            }

            > .price {
                font-size: 14px;
                line-height: 1.4;
                font-weight: 600;
                padding-top: 10px;
                color: $color-primary;
                display: flex;
                flex-direction: row;

                .style-tag {
                    margin-right: 5px;

                    &:first-child {
                        margin-left: 0;
                    }
                }
            }
        }
        
    }

    &.selected {
        > .content > div {
            > h3 {
                transform: translateX(30px);

                >.counter {
                    opacity: 1;
                }
            }
        }
    }

    > figure {
        flex-shrink: 0;
        padding: 15px 15px 15px 0;

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