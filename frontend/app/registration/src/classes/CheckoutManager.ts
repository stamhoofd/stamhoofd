import { ArrayDecoder, Decoder, ObjectData, VersionBox, VersionBoxDecoder } from '@simonbackx/simple-encoding';
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Toast } from '@stamhoofd/components';
import { SessionManager } from '@stamhoofd/networking';
import { IDRegisterCheckout, MemberBalanceItem, RegisterCheckout, RegisterItem, Version } from '@stamhoofd/structures';

import { EditMemberStepsManager } from '../views/members/details/EditMemberStepsManager';
import { MemberManager } from './MemberManager';
import { OrganizationManager } from './OrganizationManager';
import { TabBarItem } from './TabBarItem';

/**
 * Convenient access to the organization of the current session
 */
export class CheckoutManagerStatic {
    private _checkout: RegisterCheckout | null = null

    watchTabBar: TabBarItem | null = null
    balanceItems: MemberBalanceItem[] | null = null

    saveCart() {
        this.saveCheckout()
    }

    get checkout(): RegisterCheckout {
        if (!this._checkout) {
            this._checkout = this.loadCheckout()
        }
        return this._checkout
    }

    get cart() {
        return this.checkout.cart
    }

    loadCheckout(): RegisterCheckout {
        try {
            const json = localStorage.getItem("checkout")
            if (json) {
                const obj = JSON.parse(json)
                const versionBox = new VersionBoxDecoder(IDRegisterCheckout as Decoder<IDRegisterCheckout>).decode(new ObjectData(obj, { version: Version }))
                return versionBox.data.convert(OrganizationManager.organization, MemberManager.members ?? [])
            }
        } catch (e) {
            console.error("Failed to load cart")
            console.error(e)
        }
        return new RegisterCheckout()
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

        if (this.watchTabBar) {
            this.watchTabBar.badge = this.cart.count === 0 ? "" : this.cart.count+""
        }
    }

    doSelect(item: RegisterItem) {
        const toast = new Toast("De inschrijving is toegevoegd aan jouw inschrijvingsmandje.", "success green").setHide(10000)
        toast.show()

        this.cart.addItem(item)
        CheckoutManager.saveCart()
    }

    async startAddToCartFlow(component: NavigationMixin, item: RegisterItem, callback: (component) => void) {
        if (this.cart.hasItem(item)) {
            // Already in cart
            // In the future: might give possibilty to adjust answers to questions
            this.doSelect(item)
            callback(component)
            return
        }

        const items = [...this.cart.items.filter(i => i.memberId === item.member.id), item]

        const stepManager = new EditMemberStepsManager(
            EditMemberStepsManager.getAllSteps(items, item.member, false, false), 
            items,
            item.member,
            (c: NavigationMixin) => {
                this.doSelect(item)
                callback(c)
                return Promise.resolve()
            }
        )
        const c = await stepManager.getFirstComponent()

        if (!c) {
            // Everything skipped
            this.doSelect(item)
            callback(component)
        } else {
            component.show(c)
        }
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
        const response = await SessionManager.currentSession!.authenticatedServer.request({
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
                await OrganizationManager.reloadGroups()
            }

            if (refetch || this.balanceItems === null) {
                await this.fetchBalance()
            }

            if (refetch) (
                this.lastFullRefetch = new Date()
            )

            // Revalidate
            this.cart.validate(MemberManager.members ?? [], OrganizationManager.organization.groups, OrganizationManager.organization.meta.categories, this.balanceItems!)

            if (OrganizationManager.organization.meta.recordsConfiguration.freeContribution === null) {
                this.cart.freeContribution = 0
            }
        } finally {
            try {
                this.cart.calculatePrices(MemberManager.members ?? [], OrganizationManager.organization.groups, OrganizationManager.organization.meta.categories)
            } catch (e) {
                // error in calculation!
                console.error(e)
            }
            this.saveCart()
        }
        
    }
}

export const CheckoutManager = new CheckoutManagerStatic()