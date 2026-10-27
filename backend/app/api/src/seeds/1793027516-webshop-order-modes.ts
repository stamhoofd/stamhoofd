import { Migration } from '@simonbackx/simple-database';
import { Webshop } from '@stamhoofd/models';
import { Webshop as WebshopStruct, WebshopOrderMode } from '@stamhoofd/structures';
import { SeedTools } from '../helpers/SeedTools.js';

/**
 * A webshop with a cart and a single unique product used to skip the cart automatically: it now orders one at a time
 * itself, so it keeps working the same way.
 *
 * Product.allowMultiple became nullable: null follows the order mode (see Webshop.allowsMultiple). Products with the
 * same value get null, so the setting is only kept (and shown) where it differs.
 */
export async function upgradeWebshopOrderModes() {
    let changed = 0;

    const result = await SeedTools.loop({
        batchSize: 100,
        query: Webshop.select(),
        useTransactionPerBatch: true,
        action: async (webshop: Webshop) => {
            let hasChanges = false;

            const struct = WebshopStruct.create({ meta: webshop.meta, products: webshop.products, categories: webshop.categories });
            if (webshop.meta.orderMode === WebshopOrderMode.Cart && !struct.canEnableCart) {
                webshop.meta = webshop.meta.patch({ orderMode: WebshopOrderMode.Single });
                hasChanges = true;
            }

            // One piece when ordering one at a time, several otherwise
            const single = webshop.meta.orderMode === WebshopOrderMode.Single;
            const products = webshop.products.map((product) => {
                if (product.allowMultiple === !single) {
                    hasChanges = true;
                    const clone = product.clone();
                    clone.allowMultiple = null;
                    return clone;
                }
                return product;
            });

            if (!hasChanges) {
                return;
            }
            webshop.products = products;
            await webshop.save({
                skipMarkSaved: true,
                skipSendEvents: true,
            });
            changed += 1;
        },
    });
    console.log('Upgraded the order mode of ' + changed + ' webshops of ' + result.total + ' looped webshops');
}

export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    await upgradeWebshopOrderModes();
});
