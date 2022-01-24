import { Decoder, ObjectData, VersionBox, VersionBoxDecoder } from '@simonbackx/simple-encoding'
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Toast } from '@stamhoofd/components';
import { IDRegisterCheckout, RegisterCheckout, RegisterItem, Version } from '@stamhoofd/structures'

import { EditMemberStepsManager } from '../views/members/details/EditMemberStepsManager';
import { MemberManager } from './MemberManager'
import { OrganizationManager } from './OrganizationManager'
import { TabBarItem } from './TabBarItem';

/**
 * Convenient access to the organization of the current session
 */
export class CheckoutManagerStatic {
    private _checkout: RegisterCheckout | null = null

    watchTabBar: TabBarItem | null = null

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
        new Toast("De inschrijving is toegevoegd aan jouw inschrijvingsmandje. Ga naar jouw mandje om de inschrijving af te ronden.", "success green").show()
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

        // Only ask details + parents for new members
        const items = [...this.cart.items.filter(i => i.memberId === item.member.id), item]

        const stepManager = new EditMemberStepsManager(
            EditMemberStepsManager.getAllSteps(items, item.member, false), 
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
}

export const CheckoutManager = new CheckoutManagerStatic()