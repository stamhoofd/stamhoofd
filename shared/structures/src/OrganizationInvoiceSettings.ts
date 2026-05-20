import { AutoEncoder, BooleanDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { Image } from './files/Image.js';

export class OrganizationInvoiceSettings extends AutoEncoder {
    /**
     * Whether we reset the invoice numbers yearly on the start of this month.
     * Disabled by default.
     * 
     * 1 = january
     */
    @field({ decoder: IntegerDecoder, nullable: true })
    resetMonth: number | null

    @field({ decoder: IntegerDecoder, defaultValue: () => 6 })
    padZeroLength: number

    /**
     * If this is set to true, resetMonth is expected to be 1 (january)
     */
    @field({ decoder: BooleanDecoder, defaultValue: () => false })
    prefixYear: boolean

    /**
     * To differentiate multiple invoice numbering systems used across multiple online systems
     * E.g. 'STA-', 'KEEO-
     */
    @field({ decoder: StringDecoder })
    fixedPrefix: string

    @field({ decoder: Image, nullable: true })
    background: Image | null

    /**
     * Use a different background for the 2nd and later backgrounds
     */
    @field({ decoder: Image, nullable: true })
    secondBackground: Image | null
}
