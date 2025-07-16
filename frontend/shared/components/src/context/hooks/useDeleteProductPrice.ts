import { Product, ProductPrice } from '@stamhoofd/structures';
import { CenteredMessage, Toast } from '@stamhoofd/components';
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';

export function useDeleteProductPrice() {
    const deleteProductPrice = async (product: Product, productPrice: ProductPrice): Promise<AutoEncoderPatchType<Product> | undefined> => {
        if (product.prices.some(p => p.uitpasBaseProductPriceId === productPrice.id)) {
            // this price cannot be deleted because it is used as a base price for uitpas social tariff
            Toast.error($t('fa6b77cc-0591-4611-a4f8-27a33f2eff1d')).show();
            return;
        }
        const confirmed = await CenteredMessage.confirm($t('7768f0f4-3202-4da2-a65b-7b96bfa721c9'), $t('fd5d1976-55d5-4b6d-80d8-3d847772599e'));
        if (!confirmed) return;

        const patch = Product.patch({ id: product.id });
        patch.prices.addDelete(productPrice.id);
        return patch;
    };

    return {
        deleteProductPrice,
    };
}
