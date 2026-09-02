/**
 * The OAuth permissions Stamhoofd asks for when connecting a Mollie account. A token keeps the
 * permissions it was authorized with (a refresh never widens them), so an account connected
 * before a permission was added here has to be reconnected.
 */
export const MollieRequiredScopes: string[] = [
    'payments.read',
    'payments.write',
    'refunds.read',
    'refunds.write',
    'organizations.read',
    'organizations.write',
    'onboarding.read',
    'onboarding.write',
    'profiles.read',
    'profiles.write',
    'subscriptions.read',
    'subscriptions.write',
    'mandates.read',
    'mandates.write',
    'settlements.read',
    'balances.read',
    'orders.read',
    'orders.write',
    'customers.read',
    'customers.write',
    'webhooks.read',
    'webhooks.write',
];
