import type { BalanceItem } from '../BalanceItem.js';
import { BalanceItemType } from '../BalanceItem.js';
import { BreakdownGroup } from '../PaymentBreakdown.js';
import { TranslatedString } from '../TranslatedString.js';
import type { CartItem } from '../webshops/CartItem.js';
import type { OrderData } from '../webshops/Order.js';

/**
 * One line of a webshop order: a product, the delivery cost or the administration cost.
 */
export type OrderArticle = { id: string; name: string; description: string; icon: string; price: number; quantity: number };

export function createOrderArticleGroup(article: OrderArticle): BreakdownGroup {
    return BreakdownGroup.create({
        id: article.id,
        name: new TranslatedString(article.name),
        description: article.description,
        icon: article.icon,
    });
}

/**
 * Splits one line of a cart into the article that was ordered and the options that were chosen for it,
 * so an option can be counted on its own instead of hiding inside every combination it was part of.
 *
 * The chosen options are priced separately, the article keeps what is left: that way the rows still add
 * up to what the cart line costs, including its discounts and seat or UiTPAS prices.
 */
function getCartItemArticles(item: CartItem): OrderArticle[] {
    const options: OrderArticle[] = item.options.map(({ option, optionMenu }) => ({
        id: 'option-' + optionMenu.id + '-' + option.id,
        name: optionMenu.name + ': ' + option.name,
        description: item.product.name,
        icon: 'add',
        price: option.price * item.amount,
        quantity: item.amount,
    }));

    return [
        {
            // Without the field answers: two t-shirts with a different name printed on them are one article
            id: 'product-' + item.product.id + '-' + item.productPrice.id,
            name: item.product.name,
            // Only the price that was chosen: the options are rows of their own
            description: item.product.prices.length > 1 ? item.productPrice.name : '',
            icon: 'basket',
            price: item.getPriceWithDiscounts() - options.reduce((total, option) => total + option.price, 0),
            quantity: item.amount,
        },
        ...options,
    ];
}

/**
 * Splits a webshop order into the articles that were ordered. Returns null when the balance item isn't
 * a webshop order, or when the amount doesn't match the order (an edited or refunded order can't be
 * attributed to single articles).
 *
 * @param isPaymentShare Whether the amount is a part of what was paid for the order instead of what
 * the order costs. Only then an amount below the total means the order was paid in parts.
 */
export function getOrderArticles(balanceItem: BalanceItem, price: number, orders: Map<string, OrderData>, isPaymentShare: boolean): OrderArticle[] | null {
    if (balanceItem.type !== BalanceItemType.Order || !balanceItem.orderId) {
        return null;
    }

    const order = orders.get(balanceItem.orderId);

    if (!order) {
        return null;
    }

    if (price !== order.totalPrice) {
        // A part of the order was paid, refunded or changed, so we can't say which articles it was for
        return [getUnmatchedOrderArticle(price, order, isPaymentShare)];
    }

    const articles: OrderArticle[] = order.cart.items.flatMap(item => getCartItemArticles(item));
    const discount = getOrderDiscount(order);

    if (discount) {
        articles.push({ id: 'order-discount', name: $t('%176'), description: '', icon: 'label', price: -discount, quantity: 0 });
    }

    if (order.deliveryPrice) {
        articles.push({ id: 'order-delivery', name: $t('%Sn'), description: '', icon: 'send', price: order.deliveryPrice, quantity: 1 });
    }

    if (order.administrationFee) {
        articles.push({ id: 'order-administration-fee', name: $t('%xK'), description: '', icon: 'calculator', price: order.administrationFee, quantity: 1 });
    }

    return mergeArticles(articles);
}

/**
 * How an amount that doesn't match the order it belongs to is shown: paying an order in instalments is
 * something else than changing it afterwards.
 */
function getUnmatchedOrderArticle(price: number, order: OrderData, isPaymentShare: boolean): OrderArticle {
    if (price < 0) {
        return { id: 'order-refund', name: $t('%ZjK'), description: '', icon: 'undo', price, quantity: 0 };
    }

    if (isPaymentShare && price < order.totalPrice) {
        return { id: 'order-partial', name: $t('%Zjb'), description: '', icon: 'partially', price, quantity: 0 };
    }

    return { id: 'order-changed', name: $t('%Zik'), description: '', icon: 'edit', price, quantity: 0 };
}

/**
 * What a discount code took off the order as a whole, which is not part of the lines of the cart. Never
 * more than what the cart costs, because the total of an order is never negative.
 */
function getOrderDiscount(order: OrderData): number {
    const cartPrice = order.cart.priceWithDiscounts;
    return cartPrice - Math.max(0, cartPrice - order.appliedPercentageDiscount - order.fixedDiscount);
}

/**
 * Adds up the lines of one order that are the same article, e.g. two lines of the same t-shirt in
 * different sizes, so an order counts once in every row it lands in.
 */
function mergeArticles(articles: OrderArticle[]): OrderArticle[] {
    const merged = new Map<string, OrderArticle>();

    for (const article of articles) {
        const existing = merged.get(article.id);

        if (!existing) {
            merged.set(article.id, { ...article });
            continue;
        }

        existing.price += article.price;
        existing.quantity += article.quantity;
    }

    return [...merged.values()];
}
