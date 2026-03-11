import { Product, ProductPrice } from '@stamhoofd/structures';
import { CenteredMessage, Toast } from '@stamhoofd/components';
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';

export function useDeleteProductPrice() {
    const deleteProductPrice = async (product: Product, productPrice: ProductPrice): Promise<AutoEncoderPatchType<Product> | undefined> => {
        if (product.prices.some(p => p.uitpasBaseProductPriceId === productPrice.id)) {
            // this price cannot be deleted because it is used as a base price for uitpas social tariff
            Toast.error($t('%1Ae')).show();
            return;
        }
        const confirmed = await CenteredMessage.confirm($t('%1Af'), $t('%CJ'));
        if (!confirmed) return;

        const patch = Product.patch({ id: product.id });
        patch.prices.addDelete(productPrice.id);
        return patch;
    };

    return {
        deleteProductPrice,
    };
}
