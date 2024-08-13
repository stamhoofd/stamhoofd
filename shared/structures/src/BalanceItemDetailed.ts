import { field } from "@simonbackx/simple-encoding"

import { BalanceItem, BalanceItemPayment, BalanceItemRelationType, BalanceItemType, shouldAggregateOnRelationType } from "./BalanceItem"
import { RegistrationWithMember } from "./members/RegistrationWithMember"
import { Order } from "./webshops/Order"

// Do we still need this?
export class BalanceItemDetailed extends BalanceItem {
    @field({ decoder: RegistrationWithMember, nullable: true })
    registration: RegistrationWithMember | null = null

    @field({ decoder: Order, nullable: true })
    order: Order | null = null
}

export class BalanceItemPaymentDetailed extends BalanceItemPayment {
    @field({ decoder: BalanceItem })
    balanceItem: BalanceItem

    /**
     * Note: this can be a float in case of partial payments
     * Try to avoid using this in calculations, as this is not super reliable
     * 
     * Always round when displaying!
     */
    get amount() {
        if (this.unitPrice === 0) {
            // Not possible to calculate amount
            return this.balanceItem.amount;
        }

        return this.price / this.unitPrice;
    }

    get unitPrice() {
        if (this.price < 0 && this.balanceItem.unitPrice > 0) {
            return -this.balanceItem.unitPrice
        }
        return this.balanceItem.unitPrice
    }


    get groupPrefix(): string {
        switch (this.balanceItem.type) {
            case BalanceItemType.Registration: {
                if (this.balanceItem.relations.get(BalanceItemRelationType.GroupOption)) {
                    const group = this.balanceItem.relations.get(BalanceItemRelationType.Group)?.name || 'Onbekende inschrijvingsgroep';
                    return 'Inschrijving voor ' + group;
                }
                return 'Inschrijving'
            }
            case BalanceItemType.AdministrationFee: return 'Administratiekosten'
            case BalanceItemType.FreeContribution: return 'Vrije bijdrage'
            case BalanceItemType.Order: return 'Bestelling'
            case BalanceItemType.Other: return 'Andere'
        }
    }

    get groupTitle(): string {
        switch (this.balanceItem.type) {
            case BalanceItemType.Registration: {
                const option = this.balanceItem.relations.get(BalanceItemRelationType.GroupOption);
                if (option) {
                    const optionMenu = this.balanceItem.relations.get(BalanceItemRelationType.GroupOptionMenu)
                    return (optionMenu?.name ?? 'Onbekend') + ': ' + option.name;
                }
                const group = this.balanceItem.relations.get(BalanceItemRelationType.Group)?.name || 'Onbekende inschrijvingsgroep';
                const price = this.balanceItem.relations.get(BalanceItemRelationType.GroupPrice)?.name;
                return group + (price && price !== 'Standaardtarief'  ? ' (' + price + ')' : '');
            }
            case BalanceItemType.AdministrationFee: return 'Administratiekosten'
            case BalanceItemType.FreeContribution: return 'Vrije bijdrage'
            case BalanceItemType.Order: return this.balanceItem.relations.get(BalanceItemRelationType.Webshop)?.name || 'Onbekende webshop'
            case BalanceItemType.Other: return this.balanceItem.description
        }
    }

    get groupDescription() {
        return null
    }

    /**
     * When displayed as a single item
     */
    get itemPrefix(): string {
        switch (this.balanceItem.type) {
            case BalanceItemType.Registration: {
                if (this.balanceItem.relations.get(BalanceItemRelationType.GroupOption)) {
                    const group = this.balanceItem.relations.get(BalanceItemRelationType.Group)?.name || 'Onbekende inschrijvingsgroep';
                    return 'Inschrijving voor ' + group;
                }
                return 'Inschrijving'
            }
            case BalanceItemType.AdministrationFee: return 'Administratiekosten'
            case BalanceItemType.FreeContribution: return 'Vrije bijdrage'
            case BalanceItemType.Order: return 'Bestelling'
            case BalanceItemType.Other: return 'Andere'
        }
    }

    /**
     * When displayed as a single item
     */
    get itemTitle(): string {
        switch (this.balanceItem.type) {
            case BalanceItemType.Registration: {
                const option = this.balanceItem.relations.get(BalanceItemRelationType.GroupOption);
                if (option) {
                    const optionMenu = this.balanceItem.relations.get(BalanceItemRelationType.GroupOptionMenu)
                    return (optionMenu?.name ?? 'Onbekend') + ': ' + option.name;
                }
                const group = this.balanceItem.relations.get(BalanceItemRelationType.Group)?.name || 'Onbekende inschrijvingsgroep';
                const price = this.balanceItem.relations.get(BalanceItemRelationType.GroupPrice)?.name;
                return group + (price && price !== 'Standaardtarief' ? ' (' + price + ')' : '');
            }
            case BalanceItemType.AdministrationFee: return 'Administratiekosten'
            case BalanceItemType.FreeContribution: return 'Vrije bijdrage'
            case BalanceItemType.Order: return this.balanceItem.relations.get(BalanceItemRelationType.Webshop)?.name || 'Onbekende webshop'
            case BalanceItemType.Other: return this.balanceItem.description
        }
    }

    /**
     * When displayed as a single item
     */
    get itemDescription() {
        switch (this.balanceItem.type) {
            case BalanceItemType.Registration: {
                const member = this.balanceItem.relations.get(BalanceItemRelationType.Member);
                if (member) {
                    return member.name;
                }
            }
        }
        return null;
    }

    /**
     * Unique identifier whithing a reporting group
     */
    get groupCode() {
        if (this.balanceItem.type === BalanceItemType.Other) {
            return 'type-'+this.balanceItem.type
                + '-unit-price-'+this.unitPrice 
                + '-description-'+this.balanceItem.description;
        }

        return 'type-'+this.balanceItem.type
            + '-unit-price-'+this.unitPrice 
            + '-relations' + Array.from(this.balanceItem.relations.entries())
                .filter(([key]) => !shouldAggregateOnRelationType(key, this.balanceItem.relations))
                .map(([key, value]) => key + '-' + value.id)
                .join('-');
    }

}
