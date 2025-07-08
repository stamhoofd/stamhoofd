import { Product, ProductPrice } from '@stamhoofd/structures';
import { CenteredMessage, Toast } from '@stamhoofd/components';
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';

export async function useDeleteProductPrice(product: Product, productPrice: ProductPrice): Promise<AutoEncoderPatchType<Product> | undefined> {
    if (product.prices.some(p => p.uitpasBaseProductPriceId === productPrice.id)) {
        // this price cannot be deleted because it is used as a base price for uitpas social tariff
        Toast.error($t('Deze prijs kan niet verwijderd worden omdat deze gebruikt wordt als basisprijs voor een UiTPAS kansentarief.')).show();
        return;
    }
    const confirmed = await CenteredMessage.confirm($t('Deze prijs verwijderen?'), $t('Verwijderen'));
    if (!confirmed) return;

    const patch = Product.patch({ id: product.id });
    patch.prices.addDelete(productPrice.id);
    return patch;
}
