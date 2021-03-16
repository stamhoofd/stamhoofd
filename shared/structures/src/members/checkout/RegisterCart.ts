import { ArrayDecoder, AutoEncoder, field } from "@simonbackx/simple-encoding"

// eslint bug marks types as "unused"
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Organization } from "../../Organization"
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { MemberWithRegistrations } from "../MemberWithRegistrations"
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { IDRegisterItem, RegisterItem } from "./RegisterItem"


/**
 * Contains all information about a given checkout
 */
export class RegisterCart {
    items: RegisterItem[] = []

    convert(): IDRegisterCart {
        return IDRegisterCart.create({
            items: this.items.map(i => i.convert())
        })
    }

    /**
     * todo
     */
    get price(): number {
        return 0
    }

    get count(): number {
        return this.items.length
    }

    hasItem(item: RegisterItem): boolean {
        const c = item.id
        for (const i of this.items) {
            if (i.id === c) {
                return true
            }
        }
        return false
    }

    addItem(item: RegisterItem): void {
        const c = item.id
        for (const [index, i,] of this.items.entries()) {
            if (i.id === c) {

                // replace
                this.items.splice(index, 1)
                break;
            }
        }
        this.items.push(item)
    }

    removeItem(item: RegisterItem): void {
        const c = item.id
        for (const [index, i] of this.items.entries()) {
            if (i.id === c) {
                this.items.splice(index, 1)
                return
            }
        }
    }

    validate(): void {
        // todo
    }
}

/**
 * Contains all information about a given checkout
 */
export class IDRegisterCart extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(IDRegisterItem) })
    items: IDRegisterItem[] = []

    convert(organization: Organization, members: MemberWithRegistrations[]): RegisterCart {
        const cart = new RegisterCart()
        cart.items = this.items.flatMap((item) => {
            const converted = item.convert(organization, members)
            if (converted !== null) {
                return [converted]
            }
            return []
        })

        return cart
    }
}