import { ArrayDecoder, Decoder, ObjectData, VersionBox, VersionBoxDecoder } from '@simonbackx/simple-encoding';
import { Toast } from '@stamhoofd/components';
import { MemberBalanceItem, OldIDRegisterCheckout, OldRegisterCheckout, OldRegisterItem, Version } from '@stamhoofd/structures';
import { reactive } from 'vue';

import { MemberManager } from './MemberManager';

/**
 * Convenient access to the organization of the current session
 */
export class CheckoutManager {
    private _checkout: OldRegisterCheckout | null = null

    balanceItems: MemberBalanceItem[] | null = null
    $memberManager: MemberManager

    constructor($memberManager: MemberManager) {
        this.$memberManager = $memberManager
    }

    get $organization() {
        return this.$memberManager.$context.organization!
    }

    get $context() {
        return this.$memberManager.$context
    }

    saveCart() {
        this.saveCheckout()
    }

    get checkout(): OldRegisterCheckout {
        if (!this._checkout) {
            this._checkout = reactive(this.loadCheckout()) as OldRegisterCheckout
        }
        return this._checkout
    }

    get cart() {
        return this.checkout.cart
    }

    loadCheckout(): OldRegisterCheckout {
        try {
            const json = localStorage.getItem("checkout")
            if (json) {
                const obj = JSON.parse(json)
                const versionBox = new VersionBoxDecoder(OldIDRegisterCheckout as Decoder<OldIDRegisterCheckout>).decode(new ObjectData(obj, { version: Version }))
                return versionBox.data.convert(this.$organization, this.$memberManager.members ?? [])
            }
        } catch (e) {
            console.error("Failed to load cart")
            console.error(e)
        }
        return new OldRegisterCheckout()
    }

    saveCheckout() {
        try {
            const data = new VersionBox(this.checkout.convert()).encode({ version: Version })
            const json = JSON.stringify(data)
            localStorage.setItem("checkout", json)
        } catch (e) {
            console.error("Failed to load cart")
            console.error(e)
        }
    }

    doSelect(item: OldRegisterItem) {
        const toast = new Toast("De inschrijving is toegevoegd aan jouw inschrijvingsmandje.", "success green").setHide(10000)
        toast.show()

        this.cart.addItem(item)
        this.saveCart()
    }

    async startAddToCartFlow(component: NavigationMixin, item: OldRegisterItem, callback: (component) => void) {
        if (this.cart.hasItem(item)) {
            // Already in cart
            // In the future: might give possibilty to adjust answers to questions
            this.doSelect(item)
            callback(component)
            return
        }

        const items = [...this.cart.items.filter(i => i.memberId === item.member.id), item]

        // const stepManager = new EditMemberStepsManager(
        //     this.$memberManager,
        //     EditMemberStepsManager.getAllSteps(this.$memberManager.$context, false, false), 
        //     items,
        //     item.member,
        //     (c: NavigationMixin) => {
        //         this.doSelect(item)
        //         callback(c)
        //         return Promise.resolve()
        //     }
        // )
        // const c = await stepManager.getFirstComponent()
        // 
        // if (!c) {
        //     // Everything skipped
        //     this.doSelect(item)
        //     callback(component)
        // } else {
        //     component.show(c)
        // }
    }

    fetchBalancePromise: Promise<void>|null = null

    async fetchBalance() {
        if (this.fetchBalancePromise) {
            return this.fetchBalancePromise
        }
        this.fetchBalancePromise = this._fetchBalance()
        await this.fetchBalancePromise
        this.fetchBalancePromise = null
    }

    async _fetchBalance() {
        const response = await this.$memberManager.$context.authenticatedServer.request({
            method: 'GET',
            path: '/balance',
            decoder: new ArrayDecoder(MemberBalanceItem as Decoder<MemberBalanceItem>)
        })
        this.balanceItems = response.data
    }

    lastFullRefetch = new Date() // On load

    isLastFullRefetchOld(ageInSeconds: number = 10 * 60) {
        return (new Date().getTime() - this.lastFullRefetch.getTime()) / 1000 > ageInSeconds
    }

    async recalculateCart(refetch = false) {
        console.log("Recalculate cart", refetch)
        try {
            // Reload groups
            if (refetch) {
                await this.$context.fetchOrganization()
            }

            if (refetch || this.balanceItems === null) {
                await this.fetchBalance()
            }

            if (refetch) (
                this.lastFullRefetch = new Date()
            )

            // Revalidate
            this.cart.validate(this.$memberManager.members ?? [], this.$organization.groups, this.$organization.meta.categories, this.balanceItems!)

            if (this.$organization.meta.recordsConfiguration.freeContribution === null) {
                this.cart.freeContribution = 0
            }
        } finally {
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
            this.saveCart()
        }
        
    }
}
