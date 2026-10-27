import type { AutoEncoderPatchType } from '@common/encoding';
import { GroupUIFilterBuilder } from '@stamhoofd/components/filters/GroupUIFilter.ts';
import { RecordEditorSettings, RecordEditorType } from '@stamhoofd/components/records/RecordEditorSettings.ts';
import type { Product } from '@stamhoofd/structures';
import { CartItem } from '@stamhoofd/structures';
import { CustomerSettings } from '@stamhoofd/structures/webshops/CustomerSettings.js';

/**
 * Settings for the editor of the questions asked per participant of a product
 */
export function createParticipantRecordEditorSettings(product: Product) {
    return new RecordEditorSettings({
        type: RecordEditorType.Webshop,
        dataPermission: false,
        filterBuilder: () => new GroupUIFilterBuilder({ builders: [] }),
        exampleValue: CartItem.create({ product, productPrice: product.prices[0] }),
    });
}

/**
 * Product patch for a change to its participant details: stores a full object while the product still uses the defaults
 */
export function getParticipantSettingsPatch(product: Product, patch: AutoEncoderPatchType<CustomerSettings>) {
    return {
        customerSettings: product.customerSettings === null ? CustomerSettings.create({}).patch(patch) : patch,
    };
}
