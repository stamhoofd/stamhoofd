import { Formatter } from './Formatter.js';

// These segments are currently not straightforward to detect automatically because
// the webshop app uses imperative navigation instead of a central route table.
// Keep this list in sync with the webshop app and look into automating this.
export const reservedWebshopPathSegments = [
    'checkout',
    'order',
    'cart',
    'payment',
    'tickets',
    'code',
] as const;

export function isReservedWebshopPathSegment(segment: string): boolean {
    return reservedWebshopPathSegments.includes(Formatter.slug(segment) as typeof reservedWebshopPathSegments[number]);
}
