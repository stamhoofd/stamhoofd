import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Toast } from '@stamhoofd/components';
import { I18nController } from '@stamhoofd/frontend-i18n';
import { UrlHelper } from '@stamhoofd/networking';
import { Checkout, CheckoutMethod, CheckoutMethodType, OrganizationMetaData, RecordAnswer, Webshop } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import { CheckoutManager } from '../../classes/CheckoutManager';

export enum CheckoutStepType {
    "Method" = "Method",
    "Address" = "Address",
    "Customer" = "Customer",
    "Time" = "Time",
    "Payment" = "Payment",
}

export class CheckoutStep {
    id: string
    active: boolean
    url: string;
    skipHandler?: () => void
    getComponent: () => Promise<ComponentWithProperties>
    validate: (checkout: Checkout, webshop: Webshop, organizationMeta: OrganizationMetaData) => void

    constructor(data: {
        id: string,
        active?: boolean, 
        url: string,
        skipHandler?: () => void,
        getComponent: () => Promise<ComponentWithProperties>,
        validate: (checkout: Checkout, webshop: Webshop, organizationMeta: OrganizationMetaData) => void
    }) {
        this.id = data.id
        this.active = data.active ?? true
        this.skipHandler = data.skipHandler
        this.getComponent = data.getComponent
        this.validate = data.validate
        this.url = data.url
    }

    // async getComponent(): Promise<any> {
    //     switch (this.type) {
    //         case CheckoutStepType.Method: return (await import(/* webpackChunkName: "Checkout", webpackPrefetch: true */ './CheckoutMethodSelectionView.vue')).default;
    //         case CheckoutStepType.Address: return (await import(/* webpackChunkName: "Checkout", webpackPrefetch: true */ './AddressSelectionView.vue')).default;
    //         case CheckoutStepType.Time:return (await import(/* webpackChunkName: "Checkout", webpackPrefetch: true */ './TimeSelectionView.vue')).default;
    //         case CheckoutStepType.Payment: return (await import(/* webpackChunkName: "Checkout", webpackPrefetch: true */ './PaymentSelectionView.vue')).default;
    //         case CheckoutStepType.Customer: return (await import(/* webpackChunkName: "Checkout", webpackPrefetch: true */ './CustomerView.vue')).default;
// 
    //         default: {
    //             // If you get a compile error here, a type is missing in the switch and you should add it
    //             const t: never = this.type
    //             throw new Error("Missing component for "+t)
    //         }
    //     }
    // }
// 
    // validate(checkout: Checkout, webshop: Webshop, organizationMeta: OrganizationMetaData) {
    //     switch (this.type) {
    //         case CheckoutStepType.Method: checkout.validateCheckoutMethod(webshop, organizationMeta); return;
    //         case CheckoutStepType.Address: checkout.validateDeliveryAddress(webshop, organizationMeta); return;
    //         case CheckoutStepType.Time: checkout.validateTimeSlot(webshop, organizationMeta); return;
    //         case CheckoutStepType.Payment: checkout.validate(webshop, organizationMeta, I18nController.i18n); return;
    //         case CheckoutStepType.Customer: checkout.validateCustomer(webshop, organizationMeta, I18nController.i18n); return;
// 
    //         default: {
    //             // If you get a compile error here, a type is missing in the switch and you should add it
    //             const t: never = this.type
    //             throw new Error("Missing validate for "+t)
    //         }
    //     }
    // }
}

export class CheckoutStepsManager {
    $checkoutManager: CheckoutManager;

    private constructor($checkoutManager: CheckoutManager) {
        this.$checkoutManager = $checkoutManager
    }

    get $webshopManager() {
        return this.$checkoutManager.$webshopManager
    }

    get $context() {
        return this.$webshopManager.$context
    }

    static for($checkoutManager: CheckoutManager) {
        return new CheckoutStepsManager($checkoutManager)
    }

    /// Return all the steps that are confirmed with the current checkout configuration
    getSteps(): CheckoutStep[] {
        const webshop = this.$webshopManager.webshop
        const checkout = this.$checkoutManager.checkout
        const checkoutMethod = webshop.meta.checkoutMethods.find(m => m.id === checkout.checkoutMethod?.id) ?? (webshop.meta.checkoutMethods[0] as CheckoutMethod | undefined) ?? null;
        const steps: CheckoutStep[] = []

        steps.push(
            new CheckoutStep({
                id: CheckoutStepType.Method,
                url: "/checkout/"+CheckoutStepType.Method.toLowerCase(),
                active: webshop.meta.checkoutMethods.length > 1,
                skipHandler: () => {
                    // Skip behaviour
                    // Set to the only available checkout method
                    this.$checkoutManager.checkout.checkoutMethod = this.$webshopManager.webshop.meta.checkoutMethods.length == 0 ? null : this.$webshopManager.webshop.meta.checkoutMethods[0]
                    this.$checkoutManager.saveCheckout()
                },
                getComponent: () => import(/* webpackChunkName: "Checkout", webpackPrefetch: true */ './CheckoutMethodSelectionView.vue').then(m => new ComponentWithProperties(m.default, {})),
                validate: (checkout, webshop, organizationMeta) => checkout.validateCheckoutMethod(webshop, organizationMeta)
            })
        )

        steps.push(
            new CheckoutStep({
                id: CheckoutStepType.Time,
                url: "/checkout/"+CheckoutStepType.Time.toLowerCase(),
                active: checkoutMethod !== null && checkoutMethod.timeSlots.timeSlots.length > 1,
                skipHandler: () => {
                    // Use default or set to null if none available
                    if (this.$checkoutManager.checkout.checkoutMethod && this.$checkoutManager.checkout.checkoutMethod.timeSlots.timeSlots.length == 1) {
                        this.$checkoutManager.checkout.timeSlot = this.$checkoutManager.checkout.checkoutMethod.timeSlots.timeSlots[0]
                    } else {
                        this.$checkoutManager.checkout.timeSlot = null
                    }
                    
                    this.$checkoutManager.saveCheckout()
                },
                getComponent: () => import(/* webpackChunkName: "Checkout", webpackPrefetch: true */ './TimeSelectionView.vue').then(m => new ComponentWithProperties(m.default, {})),
                validate: (checkout, webshop, organizationMeta) => checkout.validateTimeSlot(webshop, organizationMeta)
            })
        )

        steps.push(
            new CheckoutStep({
                id: CheckoutStepType.Address,
                url: "/checkout/"+CheckoutStepType.Address.toLowerCase(),
                active: checkoutMethod !== null && checkoutMethod.type == CheckoutMethodType.Delivery,
                skipHandler: () => {
                    // Skip behaviour
                    // Clear address
                    this.$checkoutManager.checkout.address = null
                    this.$checkoutManager.saveCheckout()
                },
                getComponent: () => import(/* webpackChunkName: "Checkout", webpackPrefetch: true */ './AddressSelectionView.vue').then(m => new ComponentWithProperties(m.default, {})),
                validate: (checkout, webshop, organizationMeta) => checkout.validateDeliveryAddress(webshop, organizationMeta)
            })
        )

        const loggedIn = this.$context.isComplete() ?? false;
        const user = loggedIn ? (this.$context.user ?? null) : null;

        steps.push(new CheckoutStep({
            id: CheckoutStepType.Customer,
            url: "/checkout/"+CheckoutStepType.Customer.toLowerCase(),
            active: !loggedIn || webshop.meta.phoneEnabled || !user?.firstName || !user?.lastName,
            getComponent: () => import(/* webpackChunkName: "Checkout", webpackPrefetch: true */ './CustomerView.vue').then(m => new ComponentWithProperties(m.default, {})),
            validate: (checkout, webshop, organizationMeta) => checkout.validateCustomer(webshop, organizationMeta, I18nController.i18n, false, loggedIn ? (this.$context.user ?? null) : null)
        }))

        // Now add all the Record Category steps
        const filterDefinitions = Checkout.getFilterDefinitions(webshop, webshop.meta.recordCategories);

        for (const category of webshop.meta.recordCategories) {
            const id = `category-${category.id}`
            const url = "/checkout/"+Formatter.slug(category.name)

            steps.push(new CheckoutStep({
                id,
                url,
                active: category.isEnabled(checkout, filterDefinitions, true),
                getComponent: async () => {
                    const {FillRecordCategoryView} = await import(/* webpackChunkName: "FillRecordCategoryView", webpackPrefetch: true */ '@stamhoofd/components');
                    return new ComponentWithProperties(FillRecordCategoryView, {
                        category,
                        url,
                        answers: checkout.recordAnswers,
                        markReviewed: true,
                        dataPermission: true,
                        filterDefinitions,
                        saveHandler: async (answers: RecordAnswer[], component: NavigationMixin) => {
                            checkout.recordAnswers = answers
                            this.$checkoutManager.saveCheckout()

                            // Force a save if nothing changed (to fix timeSlot + updated data)
                            await this.goNext(id, component)
                        },
                        filterValueForAnswers: (answers: RecordAnswer[]) => {
                            const checkout = Checkout.create(this.$checkoutManager.checkout)
                            checkout.recordAnswers = answers
                            return checkout;
                        }
                    });
                },
                validate: (checkout, webshop) => {
                    checkout.validateRecordAnswersFor(webshop, category)
                },
                skipHandler: () => {
                    for (const record of category.getAllRecords()) {
                        const index = this.$checkoutManager.checkout.recordAnswers.findIndex(a => a.settings.id == record.id)
                        if (index != -1) {
                            this.$checkoutManager.checkout.recordAnswers.splice(index, 1)
                        }
                    }
                    this.$checkoutManager.saveCheckout()
                }
            }))
        }

        // Payment
        steps.push(new CheckoutStep({
            id: CheckoutStepType.Payment,
            url: "/checkout/"+CheckoutStepType.Payment.toLowerCase(),
            getComponent: () => import(/* webpackChunkName: "Checkout", webpackPrefetch: true */ './PaymentSelectionView.vue').then(m => new ComponentWithProperties(m.default, {})),
            validate: (checkout, webshop, organizationMeta) => checkout.validate(webshop, organizationMeta, I18nController.i18n)
        }))

        return steps
    }

    async getNextStep(stepId: string | undefined, reload = false) {
        if (reload) {
            await this.$webshopManager.reload()
        }

        try {
            this.$checkoutManager.checkout.validateCart(this.$webshopManager.webshop, this.$webshopManager.organization.meta);
        } finally {
            this.$checkoutManager.checkout.update(this.$webshopManager.webshop)
        }

        const steps = this.getSteps()
        let next = stepId === undefined
        for (const s of steps) {
            if (next) {
                if (s.active) {
                    return s
                }

                if (s.skipHandler) {
                    s.skipHandler();
                }

                // Also validate skipped steps
                s.validate(this.$checkoutManager.checkout, this.$webshopManager.webshop, this.$webshopManager.organization.meta)
                continue
            }

            // Validate all steps along the way
            s.validate(this.$checkoutManager.checkout, this.$webshopManager.webshop, this.$webshopManager.organization.meta)
            if (s.id === stepId) {
                next = true
            }
        }

        // Last step
        return undefined
    }

    async goNext(step: string | undefined, component: NavigationMixin) {
        const webshop = this.$webshopManager.webshop
        let nextStep: CheckoutStep | undefined;

        // Force a save if nothing changed (to fix timeSlot + updated data)
        try {
            nextStep = await this.getNextStep(step, true)
        } catch (error) {
            if (isSimpleError(error) || isSimpleErrors(error)) {
                if (error.hasFieldThatStartsWith("cart")) {
                    // A cart error: force a reload and go back to the cart.
                    await this.$webshopManager.reload()
                    
                    if (webshop.shouldEnableCart) {
                        component.navigationController!.popToRoot({ force: true }).catch(e => console.error(e))
                    } else {
                        component.dismiss({ force: true })
                    }
                    Toast.fromError(error).show()
                } else if (error.hasFieldThatStartsWith("fieldAnswers")) {
                    // A cart error: force a reload and go back to the cart.
                    await this.$webshopManager.reload()

                    if (webshop.shouldEnableCart) {
                        component.navigationController!.popToRoot({ force: true }).catch(e => console.error(e))
                    } else {
                        component.dismiss({ force: true })
                    }

                    Toast.fromError(error).show()
                }
            }
            throw error;
        }

        if (!nextStep) {
            throw new SimpleError({
                code: "missing_config",
                message: "Er ging iets mis bij het ophalen van de volgende stap"
            })
        }
        
        component.show({
            components: [await nextStep.getComponent()],
            url: UrlHelper.transformUrl(nextStep.url),
            animated: true
        });
    }
}