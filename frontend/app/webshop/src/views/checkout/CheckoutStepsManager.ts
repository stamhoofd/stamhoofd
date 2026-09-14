import type { SimpleErrors } from '@simonbackx/simple-errors';
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, ReactiveUrl } from '@simonbackx/vue-app-navigation';
import type { NavigationActions } from '@stamhoofd/components/types/NavigationActions.ts';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { I18nController } from '@stamhoofd/frontend-i18n/I18nController';
import type { CartItem, Checkout, CheckoutMethod, OrganizationMetaData, PatchAnswers, Product, Webshop } from '@stamhoofd/structures';
import { CheckoutMethodType, WebshopOrderMode } from '@stamhoofd/structures';
import { CustomerFieldRequirement } from '@stamhoofd/structures/webshops/CustomerFieldRequirement.js';
import { Formatter } from '@stamhoofd/utility';

import { patchObject } from '@simonbackx/simple-encoding';
import type { CheckoutManager } from '../../classes/CheckoutManager';

export enum CheckoutStepType {
    Method = 'Method',
    Address = 'Address',
    Customer = 'Customer',
    Time = 'Time',
    Payment = 'Payment',
    Details = 'Details',
}

/**
 * Whether the bulk details step needs input for this item
 */
export function cartItemNeedsDetails(item: CartItem): boolean {
    return item.product.optionMenus.length > 0
        || item.product.customFields.length > 0
        || item.product.enableCustomer
        || item.productPrice.uitpasBaseProductPriceId !== null;
}

export class CheckoutStep {
    id: string;
    active: boolean;
    url: string;
    skipHandler?: () => void;
    getComponent: () => Promise<ComponentWithProperties>;
    validate: (checkout: Checkout, webshop: Webshop, organizationMeta: OrganizationMetaData) => void;

    constructor(data: {
        id: string;
        active?: boolean;
        url: string;
        skipHandler?: () => void;
        getComponent: () => Promise<ComponentWithProperties>;
        validate: (checkout: Checkout, webshop: Webshop, organizationMeta: OrganizationMetaData) => void;
    }) {
        this.id = data.id;
        this.active = data.active ?? true;
        this.skipHandler = data.skipHandler;
        this.getComponent = data.getComponent;
        this.validate = data.validate;
        this.url = data.url;
    }
}

export class CheckoutStepsManager {
    $checkoutManager: CheckoutManager;

    private constructor($checkoutManager: CheckoutManager) {
        this.$checkoutManager = $checkoutManager;
    }

    get $webshopManager() {
        return this.$checkoutManager.$webshopManager;
    }

    get $context() {
        return this.$webshopManager.$context;
    }

    static for($checkoutManager: CheckoutManager) {
        return new CheckoutStepsManager($checkoutManager);
    }

    static seatsStepId(product: Product) {
        return `seats-${product.id}`;
    }

    /// Return all the steps that are confirmed with the current checkout configuration
    getSteps(): CheckoutStep[] {
        const webshop = this.$webshopManager.webshop;
        const checkout = this.$checkoutManager.checkout;
        const checkoutMethod = webshop.meta.checkoutMethods.find(m => m.id === checkout.checkoutMethod?.id) ?? (webshop.meta.checkoutMethods[0] as CheckoutMethod | undefined) ?? null;
        const steps: CheckoutStep[] = [];
        const bulk = webshop.orderMode === WebshopOrderMode.Bulk;

        // Bulk: seats per seated product, then the details of every item
        const seatedProducts = bulk
            ? webshop.products.filter(p => p.seatingPlanId !== null && checkout.cart.items.some(i => i.product.id === p.id))
            : [];

        for (const product of seatedProducts) {
            const id = CheckoutStepsManager.seatsStepId(product);
            steps.push(new CheckoutStep({
                id,
                url: '/checkout/seats/' + Formatter.slug(product.name),
                getComponent: () => import(/* webpackChunkName: "Checkout", webpackPrefetch: true */ './BulkSeatsView.vue').then(m => new ComponentWithProperties(m.default, { product })),
                validate: (checkout) => {
                    const missing = checkout.cart.items.filter(i => i.product.id === product.id && i.seats.length !== i.amount);
                    if (missing.length > 0) {
                        throw new SimpleError({
                            code: 'invalid_seats',
                            message: 'Missing seats',
                            human: $t('Kies een plaats voor elk ticket van {product}', { product: product.name }),
                            field: 'cart',
                        });
                    }
                },
            }));
        }

        steps.push(new CheckoutStep({
            id: CheckoutStepType.Details,
            url: '/checkout/' + CheckoutStepType.Details.toLowerCase(),
            active: bulk && checkout.cart.items.some(i => cartItemNeedsDetails(i)),
            getComponent: () => import(/* webpackChunkName: "Checkout", webpackPrefetch: true */ './BulkItemDetailsView.vue').then(m => new ComponentWithProperties(m.default, {})),
            validate: () => {
                // Items are validated by validateCart at the start of getNextStep
            },
        }));

        steps.push(
            new CheckoutStep({
                id: CheckoutStepType.Method,
                url: '/checkout/' + CheckoutStepType.Method.toLowerCase(),
                active: webshop.meta.checkoutMethods.length > 1,
                skipHandler: () => {
                    // Skip behaviour
                    // Set to the only available checkout method
                    this.$checkoutManager.checkout.checkoutMethod = this.$webshopManager.webshop.meta.checkoutMethods.length == 0 ? null : this.$webshopManager.webshop.meta.checkoutMethods[0];
                    this.$checkoutManager.saveCheckout();
                },
                getComponent: () => import(/* webpackChunkName: "Checkout", webpackPrefetch: true */ './CheckoutMethodSelectionView.vue').then(m => new ComponentWithProperties(m.default, {})),
                validate: (checkout, webshop, organizationMeta) => checkout.validateCheckoutMethod(webshop, organizationMeta),
            }),
        );

        steps.push(
            new CheckoutStep({
                id: CheckoutStepType.Time,
                url: '/checkout/' + CheckoutStepType.Time.toLowerCase(),
                active: checkoutMethod !== null && checkoutMethod.timeSlots.timeSlots.length > 1,
                skipHandler: () => {
                    // Use default or set to null if none available
                    if (this.$checkoutManager.checkout.checkoutMethod && this.$checkoutManager.checkout.checkoutMethod.timeSlots.timeSlots.length == 1) {
                        this.$checkoutManager.checkout.timeSlot = this.$checkoutManager.checkout.checkoutMethod.timeSlots.timeSlots[0];
                    } else {
                        this.$checkoutManager.checkout.timeSlot = null;
                    }

                    this.$checkoutManager.saveCheckout();
                },
                getComponent: () => import(/* webpackChunkName: "Checkout", webpackPrefetch: true */ './TimeSelectionView.vue').then(m => new ComponentWithProperties(m.default, {})),
                validate: (checkout, webshop, organizationMeta) => checkout.validateTimeSlot(webshop, organizationMeta),
            }),
        );

        steps.push(
            new CheckoutStep({
                id: CheckoutStepType.Address,
                url: '/checkout/' + CheckoutStepType.Address.toLowerCase(),
                active: checkoutMethod !== null && checkoutMethod.type == CheckoutMethodType.Delivery,
                skipHandler: () => {
                    // Skip behaviour
                    // Clear address
                    this.$checkoutManager.checkout.address = null;
                    this.$checkoutManager.saveCheckout();
                },
                getComponent: () => import(/* webpackChunkName: "Checkout", webpackPrefetch: true */ './AddressSelectionView.vue').then(m => new ComponentWithProperties(m.default, {})),
                validate: (checkout, webshop, organizationMeta) => checkout.validateDeliveryAddress(webshop, organizationMeta),
            }),
        );

        const loggedIn = this.$context.isComplete() ?? false;
        const user = loggedIn ? (this.$context.user ?? null) : null;

        // When a delivery method is chosen, the address is collected in the Address step, so we don't
        // need to ask for the customer address again.
        const hasDeliveryAddress = checkoutMethod !== null && checkoutMethod.type === CheckoutMethodType.Delivery;
        const customerSettings = webshop.meta.customerSettings;
        const asks = (requirement: CustomerFieldRequirement) => requirement !== CustomerFieldRequirement.Disabled;

        steps.push(new CheckoutStep({
            id: CheckoutStepType.Customer,
            url: '/checkout/' + CheckoutStepType.Customer.toLowerCase(),
            active: !loggedIn || asks(customerSettings.phone) || asks(customerSettings.birthDay) || asks(customerSettings.gender) || (asks(customerSettings.address) && !hasDeliveryAddress) || !user?.firstName || !user?.lastName,
            getComponent: () => import(/* webpackChunkName: "Checkout", webpackPrefetch: true */ './CustomerView.vue').then(m => new ComponentWithProperties(m.default, {})),
            validate: (checkout, webshop, organizationMeta) => checkout.validateCustomer(webshop, organizationMeta, I18nController.i18n, false, loggedIn ? (this.$context.user ?? null) : null),
        }));

        for (const category of webshop.meta.recordCategories) {
            const id = `category-${category.id}`;
            const url = '/checkout/' + Formatter.slug(category.name);

            steps.push(new CheckoutStep({
                id,
                url,
                active: category.isEnabled(checkout),
                getComponent: async () => {
                    const { default: FillRecordCategoryView } = await import(/* webpackChunkName: "FillRecordCategoryView", webpackPrefetch: true */ '@stamhoofd/components/records/FillRecordCategoryView.vue');
                    return new ComponentWithProperties(FillRecordCategoryView, {
                        category,
                        url,
                        value: checkout,
                        forceMarkReviewed: true,
                        saveHandler: async (patch: PatchAnswers, navigate: NavigationActions) => {
                            checkout.recordAnswers = patchObject(checkout.recordAnswers, patch);
                            this.$checkoutManager.saveCheckout();

                            // Force a save if nothing changed (to fix timeSlot + updated data)
                            await this.goNext(id, navigate);
                        },
                        saveText: $t(`%16p`),
                    });
                },
                validate: (checkout, webshop) => {
                    checkout.validateRecordAnswersFor(webshop, category);
                },
                skipHandler: () => {
                    for (const record of category.getAllRecords()) {
                        this.$checkoutManager.checkout.recordAnswers.delete(record.id);
                    }
                    this.$checkoutManager.saveCheckout();
                },
            }));
        }

        // Payment
        steps.push(new CheckoutStep({
            id: CheckoutStepType.Payment,
            url: '/checkout/' + CheckoutStepType.Payment.toLowerCase(),
            getComponent: () => import(/* webpackChunkName: "Checkout", webpackPrefetch: true */ './PaymentSelectionView.vue').then(m => new ComponentWithProperties(m.default, {})),
            validate: (checkout, webshop, organizationMeta) => checkout.validate(webshop, organizationMeta, I18nController.i18n),
        }));

        return steps;
    }

    async getNextStep(stepId: string | undefined, reload = false) {
        if (reload) {
            await this.$webshopManager.reload();
        }

        // Bulk: seats, options, fields and customers are collected in the first checkout steps, so don't require them before those are done
        const detailsPending = this.$webshopManager.webshop.orderMode === WebshopOrderMode.Bulk && (stepId === undefined || stepId.startsWith('seats-'));

        try {
            this.$checkoutManager.checkout.validateCart(this.$webshopManager.webshop, this.$webshopManager.organization.meta, false, { validateSeats: !detailsPending, validateDetails: !detailsPending });
        } finally {
            this.$checkoutManager.checkout.update(this.$webshopManager.webshop);
        }

        const steps = this.getSteps();
        let next = stepId === undefined;
        for (const s of steps) {
            if (next) {
                if (s.active) {
                    return s;
                }

                if (s.skipHandler) {
                    s.skipHandler();
                }

                // Also validate skipped steps
                s.validate(this.$checkoutManager.checkout, this.$webshopManager.webshop, this.$webshopManager.organization.meta);
                continue;
            }

            // Validate all steps along the way
            s.validate(this.$checkoutManager.checkout, this.$webshopManager.webshop, this.$webshopManager.organization.meta);
            if (s.id === stepId) {
                next = true;
            }
        }

        // Last step
        return undefined;
    }

    /**
     * Whether an error thrown while validating or placing the order is about the cart contents
     */
    static isCartError(error: unknown): error is SimpleError | SimpleErrors {
        if (!isSimpleError(error) && !isSimpleErrors(error)) {
            return false;
        }
        return error.hasFieldThatStartsWith('cart') || error.hasFieldThatStartsWith('fieldAnswers');
    }

    /**
     * Reload the webshop, re-validate the cart and navigate back to where the user can fix the cart.
     * Bulk: to the details step when it is active, otherwise to the product list. Cart: the cart view. Single: the product view.
     */
    async handleCartError(error: SimpleError | SimpleErrors, navigate: NavigationActions) {
        const webshopManager = this.$webshopManager;
        await webshopManager.reload();

        const webshop = webshopManager.webshop;
        const cart = this.$checkoutManager.cart;

        try {
            // Stores recoverable errors on the items and drops invalid ones. Missing details are not an error yet in
            // bulk mode: the details step collects and shows them.
            cart.validate(webshop, false, { validateDetails: webshop.orderMode !== WebshopOrderMode.Bulk });
        } catch (e) {
            console.error(e);
        }
        this.$checkoutManager.saveCart();

        if (webshop.orderMode === WebshopOrderMode.Bulk) {
            const detailsStep = this.getSteps().find(s => s.id === (CheckoutStepType.Details as string));

            if (detailsStep?.active && await this.popToUrl(navigate, detailsStep.url)) {
                this.$checkoutManager.pendingCartError = error;
                return;
            }
        }

        if (this.$checkoutManager.useRootNavigation) {
            // Back to the cart, or to the webshop itself when there is no cart
            if (!webshop.shouldEnableCart || !(await this.popToUrl(navigate, 'cart'))) {
                await navigate.navigationController!.popToRoot({ force: true });
            }
        } else if (webshop.orderMode === WebshopOrderMode.Bulk || !webshop.shouldEnableCart) {
            await navigate.dismiss({ force: true });
        } else {
            await navigate.navigationController!.popToRoot({ force: true });
        }
        Toast.fromError(error).show();
    }

    /**
     * Pop back to the component with the given url on the current navigation controller. Returns false when it isn't on the stack.
     */
    private async popToUrl(navigate: NavigationActions, url: string): Promise<boolean> {
        const navigationController = navigate.navigationController;
        if (!navigationController) {
            return false;
        }
        const components = navigationController.components;
        const index = components.findIndex(c => c.provide.reactive_navigation_url?.url === url);
        if (index < 0) {
            return false;
        }
        const count = components.length - 1 - index;
        if (count > 0) {
            await navigationController.pop({ count, force: true });
        }
        return true;
    }

    async goNext(step: string | undefined, navigate: NavigationActions) {
        let nextStep: CheckoutStep | undefined;

        // Force a save if nothing changed (to fix timeSlot + updated data)
        try {
            nextStep = await this.getNextStep(step, true);
        } catch (error) {
            if (CheckoutStepsManager.isCartError(error)) {
                await this.handleCartError(error, navigate);
            }
            throw error;
        }

        if (!nextStep) {
            throw new SimpleError({
                code: 'missing_config',
                message: $t(`%Xt`),
            });
        }

        navigate.show({
            components: [await this.getStepComponent(nextStep)],
            animated: true,
        }).catch(console.error);
    }

    /**
     * The component to push for a step, carrying the step url
     */
    async getStepComponent(step: CheckoutStep): Promise<ComponentWithProperties> {
        const component = await step.getComponent();
        component.provide.reactive_navigation_url = new ReactiveUrl({
            url: step.url,
        });
        return component;
    }
}
