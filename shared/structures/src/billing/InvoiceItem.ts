import { AutoEncoder, DateDecoder, EnumDecoder, field, IntegerDecoder, MapDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { v4 as uuidv4 } from 'uuid';
import { BalanceItemRelation, BalanceItemRelationType, BalanceItemType } from '../BalanceItem.js';
import { BalanceItemPaymentDetailed } from '../BalanceItemDetailed.js';

export class InvoiceItem extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: new EnumDecoder(BalanceItemType) })
    type = BalanceItemType.Other;

    @field({ decoder: StringDecoder })
    name = '';

    @field({ decoder: StringDecoder })
    description = '';

    @field({ decoder: new MapDecoder(new EnumDecoder(BalanceItemRelationType), BalanceItemRelation) })
    relations: Map<BalanceItemRelationType, BalanceItemRelation> = new Map();

    @field({ decoder: IntegerDecoder })
    amount = 1;

    /**
     * Always excluding VAT
     */
    @field({ decoder: IntegerDecoder })
    unitPrice = 0;

    /**
     * The amount of pieces included in the unitPrice
     */
    @field({ decoder: IntegerDecoder })
    baseAmount = 1;

    /**
     * Total price, excluding VAT - rounded up to 2 decimals
     */
    @field({ decoder: IntegerDecoder })
    totalPrice = 0;

    @field({ decoder: IntegerDecoder })
    VATPercentage: number = 0;

    /**
     * Id of the balance item payment that was replaced by this invoice (optional)
     */
    @field({ decoder: StringDecoder, nullable: true })
    balanceItemPaymentId: string | null = null;

    /**
     * Member associated with this item
     */
    @field({ decoder: StringDecoder, nullable: true })
    memberId: string | null = null;

    /**
     * User associated with this item
     */
    @field({ decoder: StringDecoder, nullable: true })
    userId: string | null = null;

    /**
     * Registration associated with this item
     */
    @field({ decoder: StringDecoder, nullable: true })
    registrationId: string | null = null;

    /**
     * Package associated with this item
     */
    @field({ decoder: StringDecoder, nullable: true })
    packageId: string | null = null;

    @field({ decoder: DateDecoder })
    createdAt = new Date();

    // Invoices moeten omzetbaar zijn in een PEPPOL factuur. Veronderstellingen:
    // Alle prijzen zijn altijd exclusief BTW
    // Bij een omrekening naar een prijs exclusief BTW, behouden we zoveel mogelijk decimalen als kan in PEPPOL
    static createFromBalanceItem(item: BalanceItemPaymentDetailed) {
        if (item.balanceItem.VATPercentage === null) {
            throw new SimpleError({
                code: 'missing_vat_percentage',
                message: 'A VAT percentage is missing for a balance item. We cannot yet create an invoice.',
                human: $t('Voor één van de items is nog geen BTW-percentage ingesteld, waardoor we nog niet automatisch een factuur kunnen aanmaken.'),
            });
        }

        // base quantity = how many items for the unit price
        let unitPrice = 0;
        let baseAmount = 1;

        let amount = Math.round(item.amount);
        if (amount !== item.amount) {
            // Not possible to simulate this amount as this is only a partial payment
            // we would get too many rounding issues
            amount = 1;
            unitPrice = item.price;
        }
        else {
            unitPrice = item.unitPrice;
        }

        if (unitPrice * amount !== item.price) {
            throw new Error('Unexpected price difference. Expected ' + item.price + ', got ' + unitPrice + ' * ' + amount);
        }

        // Now convert to a price exluding VAT if required
        if (item.balanceItem.VATIncluded) {
            // Note the unit price will be rounded up to 4 decimals, so we have a bit more room for corrections
            unitPrice = Math.round(item.price - item.price * 100 / (100 + item.balanceItem.VATPercentage));

            // To reduce rounding issues, we set base quantity to amount here, so we don't have rounding per piece, but only on the total pieces
            baseAmount = amount;
        }

        return InvoiceItem.create({
            type: item.balanceItem.type,
            name: item.balanceItem.itemTitle,
            description: item.balanceItem.itemDescription ?? '',
            relations: item.balanceItem.relations,
            baseAmount,
            unitPrice,
            amount,

            balanceItemPaymentId: item.id,

            VATPercentage: item.balanceItem.VATPercentage,

            memberId: item.balanceItem.memberId,
            registrationId: item.balanceItem.registrationId,
            userId: item.balanceItem.userId,

            createdAt: item.balanceItem.createdAt,
        });
    }
}
