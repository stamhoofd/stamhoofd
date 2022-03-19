<template>
    <SaveView :title="title" :disabled="!isChanged" class="order-edit-view" :loading="saving" @save="save">
        <h1>
            {{ title }}
        </h1>
        
        <STErrorsDefault :error-box="errorBox" />

        <template v-if="mode === 'comments'">
            <STInputBox error-fields="data.comments" :error-box="errorBox" class="max">
                <textarea
                    v-model="comments"
                    class="input large"
                    type="text"
                    placeholder="Hou zelf interne notities bij voor deze bestelling"
                    autocomplete=""
                />
            </STInputBox>
        </template>
        <template v-else>
            <hr>
            <h2>Klantgegevens</h2>

            <STInputBox title="Jouw naam" error-fields="firstName,lastName" :error-box="errorBox">
                <div class="input-group">
                    <div>
                        <input v-model="firstName" class="input" name="fname" type="text" placeholder="Voornaam" required autocomplete="given-name">
                    </div>
                    <div>
                        <input v-model="lastName" class="input" name="lname" type="text" placeholder="Achternaam" required autocomplete="family-name">
                    </div>
                </div>
            </STInputBox>

            <EmailInput v-model="email" title="E-mailadres" name="email" :validator="validator" placeholder="Voor bevestingsemail" autocomplete="email" />

            <PhoneInput v-model="phone" :title="$t('shared.inputs.mobile.label' )" name="mobile" :validator="validator" placeholder="Voor dringende info" autocomplete="tel" />

            <FieldBox v-for="field in fields" :key="field.id" :with-title="false" :field="field" :answers="answersClone" :error-box="errorBox" />

            <template v-if="checkoutMethods.length > 1">
                <hr>
                <h2>Afhaalmethode</h2>

                <STList>
                    <STListItem v-for="checkoutMethod in checkoutMethods" :key="checkoutMethod.id" :selectable="true" element-name="label" class="right-stack left-center">
                        <Radio slot="left" v-model="selectedMethod" name="choose-checkout-method" :value="checkoutMethod" />
                        <h2 class="style-title-list">
                            {{ getTypeName(checkoutMethod.type) }}: {{ checkoutMethod.name }}
                        </h2>
                        <p class="style-description-small">
                            {{ checkoutMethod.description || checkoutMethod.address || "" }}
                        </p>
                        <p v-if="checkoutMethod.timeSlots.timeSlots.length == 1" class="style-description-small">
                            {{ checkoutMethod.timeSlots.timeSlots[0].date | date | capitalizeFirstLetter }} tussen {{ checkoutMethod.timeSlots.timeSlots[0].startTime | minutes }} - {{ checkoutMethod.timeSlots.timeSlots[0].endTime | minutes }}
                        </p>

                        <template v-if="checkoutMethod.timeSlots.timeSlots.length == 1">
                            <span v-if="checkoutMethod.timeSlots.timeSlots[0].listedRemainingStock === 0" slot="right" class="style-tag error">Volzet</span>
                            <span v-else-if="checkoutMethod.timeSlots.timeSlots[0].listedRemainingStock !== null" slot="right" class="style-tag">Nog {{ checkoutMethod.timeSlots.timeSlots[0].listedRemainingStock }} {{ checkoutMethod.timeSlots.timeSlots[0].remainingPersons !== null ? (checkoutMethod.timeSlots.timeSlots[0].listedRemainingStock == 1 ? "persoon" : "personen") : (checkoutMethod.timeSlots.timeSlots[0].listedRemainingStock == 1 ? "plaats" : "plaatsen") }}</span>
                        </template>
                    </STListItem>
                </STList>
            </template>

            <template v-if="selectedMethod && timeSlots.length > 0">
                <hr>
                <h2 v-if="selectedMethod.type == 'Takeout'">
                    Afhaaltijdstip
                </h2>
                <h2 v-else-if="selectedMethod.type == 'Delivery'">
                    Leveringstijdstip
                </h2>
                <h2 v-else-if="selectedMethod.type == 'OnSite'">
                    Tijdstip
                </h2>

                <p v-if="selectedMethod.type == 'Takeout'">
                    Afhaallocatie: {{ selectedMethod.name ? selectedMethod.name + ',' : '' }} {{ selectedMethod.address }}
                </p>

                <p v-if="selectedMethod.type == 'OnSite'">
                    Locatie: {{ selectedMethod.name ? selectedMethod.name + ',' : '' }} {{ selectedMethod.address }}
                </p>
                
                <STErrorsDefault :error-box="errorBox" />

                <STList>
                    <STListItem v-for="(slot, index) in timeSlots" :key="index" :selectable="true" element-name="label" class="right-stack left-center">
                        <Radio slot="left" v-model="selectedSlot" name="choose-time-slot" :value="slot" />
                        <h2 class="style-title-list">
                            {{ slot.date | dateWithDay }}
                        </h2> 
                        <p class="style-description">
                            Tussen {{ slot.startTime | minutes }} - {{ slot.endTime | minutes }}
                        </p>

                        <span v-if="slot.listedRemainingStock === 0" slot="right" class="style-tag error">Volzet</span>
                        <span v-else-if="slot.listedRemainingStock !== null" slot="right" class="style-tag">Nog {{ slot.listedRemainingStock }} {{ slot.remainingPersons !== null ? (slot.listedRemainingStock == 1 ? "persoon" : "personen") : (slot.listedRemainingStock == 1 ? "plaats" : "plaatsen") }}</span>
                    </STListItem>
                </STList>
            </template>

            <template v-if="selectedMethod && selectedMethod.type == 'Delivery'">
                <hr>
                <h2>Leveringsadres</h2>
                <div v-if="deliveryMethod && deliveryMethod.price.minimumPrice !== null && deliveryMethod.price.discountPrice !== patchedOrder.data.deliveryPrice" class="info-box">
                    Bestel minimum {{ deliveryMethod.price.minimumPrice | price }} om van een verlaagde leveringskost van {{ deliveryMethod.price.discountPrice | price }} te genieten.
                </div>

                <p v-if="patchedOrder.data.deliveryPrice == 0" class="success-box">
                    Levering is gratis
                    <template v-if="deliveryMethod && deliveryMethod.price.minimumPrice !== null && deliveryMethod.price.price != 0" class="info-box">
                        vanaf een bestelbedrag van {{ deliveryMethod.price.minimumPrice | price }}.
                    </template>
                </p>
                <p v-else class="info-box">
                    De leveringskost bedraagt {{ patchedOrder.data.deliveryPrice | price }}
                    <template v-if="deliveryMethod && deliveryMethod.price.minimumPrice !== null && deliveryMethod.price.discountPrice === patchedOrder.data.deliveryPrice" class="info-box">
                        vanaf een bestelbedrag van {{ deliveryMethod.price.minimumPrice | price }}.
                    </template>
                </p>


                <AddressInput v-model="address" :required="true" title="Vul het leveringsadres in" :validator="validator" :validate-server="server" />
            </template>
        </template>
    </SaveView>
</template>
<script lang="ts">
import { AutoEncoderPatchType, patchContainsChanges } from "@simonbackx/simple-encoding";
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { AddressInput, CartItemView, CenteredMessage, EmailInput, ErrorBox, FieldBox, LongPressDirective, PhoneInput, Radio, SaveView, STErrorsDefault, STInputBox, STList, STListItem, STNavigationBar, STToolbar, Toast, TooltipDirective, Validator } from "@stamhoofd/components";
import { I18nController } from "@stamhoofd/frontend-i18n";
import { NetworkManager } from "@stamhoofd/networking";
import { CartItem, CheckoutMethod, CheckoutMethodType, Customer, OrderData, PrivateOrder, ValidatedAddress, Version, WebshopTimeSlot } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { OrganizationManager } from "../../../../classes/OrganizationManager";
import { WebshopManager } from "../WebshopManager";
import AddItemView from "./AddItemView.vue";


@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        Radio,
        SaveView,
        STErrorsDefault,
        EmailInput,
        STInputBox,
        PhoneInput,
        AddressInput,
        FieldBox
    },
    filters: {
        price: Formatter.price.bind(Formatter),
        priceChange: Formatter.priceChange.bind(Formatter),
        date: Formatter.dateWithDay.bind(Formatter),
        dateTime: Formatter.dateTimeWithDay.bind(Formatter),
        minutes: Formatter.minutes.bind(Formatter),
        capitalizeFirstLetter: Formatter.capitalizeFirstLetter.bind(Formatter),
        dateWithDay: (d: Date) => Formatter.capitalizeFirstLetter(Formatter.dateWithDay(d)),
    },
    directives: {
        tooltip: TooltipDirective,
        LongPress: LongPressDirective
    }
})
export default class EditOrderView extends Mixins(NavigationMixin){
    @Prop({ required: true })
    initialOrder!: PrivateOrder
    
    @Prop({ required: true })
    webshopManager!: WebshopManager

    @Prop({ default: '' })
    mode!: string;

    order: PrivateOrder = this.initialOrder
    patchOrder: AutoEncoderPatchType<PrivateOrder> = PrivateOrder.patch({})
    errorBox: ErrorBox | null = null
    saving = false
    isNew = false

    validator = new Validator()
    answersClone = this.initialOrder.data.fieldAnswers.map(a => a.clone())

    get title() {
        if (this.mode === "comments") {
            return "Notities bewerken"
        }
        if (this.isNew) {
            return "Nieuwe bestelling"
        } 
        return "Bestelling bewerken"
    }

    get webshop() {
        return this.webshopManager.preview
    }

    get fields() {
        return this.webshop.meta.customFields
    }

    get finalPatch() {
        return this.patchOrder.patch(PrivateOrder.patch({
            data: OrderData.patch({
                fieldAnswers: this.answersClone
            })
        }))
    }

    get patchedOrder() {
        return this.order.patch(this.finalPatch)
    }

    get deliveryMethod() {
        return this.patchedOrder.data.deliveryMethod
    }

    get server() {
        return NetworkManager.server
    }

    // fields
    get firstName() {
        return this.patchedOrder.data.customer.firstName
    }

    set firstName(firstName: string) {
        this.patchOrder = this.patchOrder.patch(PrivateOrder.patch({
            data: OrderData.patch({
                customer: Customer.patch({
                    firstName
                })
            })
        }))
    }

    get lastName() {
        return this.patchedOrder.data.customer.lastName
    }

    set lastName(lastName: string) {
        this.patchOrder = this.patchOrder.patch(PrivateOrder.patch({
            data: OrderData.patch({
                customer: Customer.patch({
                    lastName
                })
            })
        }))
    }

    get email() {
        return this.patchedOrder.data.customer.email
    }

    set email(email: string) {
        this.patchOrder = this.patchOrder.patch(PrivateOrder.patch({
            data: OrderData.patch({
                customer: Customer.patch({
                    email
                })
            })
        }))
    }

    get phone() {
        return this.patchedOrder.data.customer.phone
    }

    set phone(phone: string) {
        this.patchOrder = this.patchOrder.patch(PrivateOrder.patch({
            data: OrderData.patch({
                customer: Customer.patch({
                    phone
                })
            })
        }))
    }

    get address() {
        return this.patchedOrder.data.address
    }

    set address(address: ValidatedAddress | null) {
        this.patchOrder = this.patchOrder.patch(PrivateOrder.patch({
            data: OrderData.patch({
                address
            })
        }))
    }

    get comments() {
        return this.patchedOrder.data.comments
    }

    set comments(comments: string) {
        this.patchOrder = this.patchOrder.patch(PrivateOrder.patch({
            data: OrderData.patch({
                comments
            })
        }))
    }

    get checkoutMethods() {
        return this.webshop.meta.checkoutMethods
    }

    get selectedMethod(): CheckoutMethod {
        if (this.patchedOrder.data.checkoutMethod) {
            const search = this.patchedOrder.data.checkoutMethod.id
            const f = this.webshop.meta.checkoutMethods.find(c => c.id == search)
            if (f) {
                return f
            }
        }
        return this.webshop.meta.checkoutMethods[0]
    }

    set selectedMethod(checkoutMethod: CheckoutMethod) {
        this.patchOrder = this.patchOrder.patch(PrivateOrder.patch({
            data: OrderData.patch({
                checkoutMethod
            })
        }))

        // Force update timeslot
        const temporaryVariable = this.selectedSlot
        this.selectedSlot = temporaryVariable ?? this.timeSlots[0] ?? null

        if (checkoutMethod.type !== CheckoutMethodType.Delivery) {
            this.address = null
        }
    }

    getTypeName(type: CheckoutMethodType) {
        switch (type) {
            case CheckoutMethodType.Takeout: return "Afhalen";
            case CheckoutMethodType.Delivery: return "Levering";
            case CheckoutMethodType.OnSite: return "Ter plaatse";
        }
    }

    // Timeslots
    get timeSlots(): WebshopTimeSlot[] {
        return this.selectedMethod?.timeSlots.timeSlots.slice().sort(WebshopTimeSlot.sort) ?? []
    }

    get selectedSlot(): WebshopTimeSlot {
        if (this.patchedOrder.data.timeSlot) {
            const search = this.patchedOrder.data.timeSlot
            const f = this.timeSlots.find(c => c.id == search.id)
            if (f) {
                return f
            }

            const f2 = this.timeSlots.find(c => c.toString() == search.toString())
            if (f2) {
                return f2
            }
        }
        return this.timeSlots[0]
    }

    set selectedSlot(timeSlot: WebshopTimeSlot | null) {
        this.patchOrder = this.patchOrder.patch(PrivateOrder.patch({
            data: OrderData.patch({
                timeSlot
            })
        }))
    }


    // Other

    imageSrc(cartItem: CartItem) {
        return cartItem.product.images[0]?.getPathForSize(100, 100)
    }

    async save() {
        if (this.saving) {
            return
        }

        try {
            const isValid = await this.validator.validate()
            if (!isValid) {
                return
            }

            await this.$nextTick();

            this.patchedOrder.data.validate(this.webshopManager.webshop!, OrganizationManager.organization.meta, I18nController.i18n);

            this.saving = true

            const patch = this.finalPatch
            patch.id = this.order.id
            const orders = await this.webshopManager.patchOrders(
                [
                    patch
                ]
            )

            // Force webshop refetch to update stocks
            await this.webshopManager.loadWebshop(false);

            this.saving = false
            new Toast("Wijzigingen opgeslagen", "success").setHide(1000).show()

            // Move all data to original order
            for (const order of orders) {
                if (order.id === this.order.id) {
                    this.order.set(order)
                }
            }
            this.patchOrder = PrivateOrder.patch({})
            this.answersClone = this.order.data.fieldAnswers.map(f => f.clone())
            this.dismiss({ force: true })
        } catch (e) {
            this.saving = false
            Toast.fromError(e).show()
        }
    }

    async addProduct() {
        let clone = this.patchedOrder.data.cart.clone()
        const webshop = await this.webshopManager.loadWebshopIfNeeded()

        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(AddItemView, { 
                cart: clone,
                webshop: webshop,
                saveHandler: (cartItem: CartItem, oldItem: CartItem | null) => {
                    cartItem.validate(webshop, clone)

                    if (oldItem) {
                        clone.removeItem(oldItem)
                    }
                    clone.addItem(cartItem)

                    if (clone.price != this.patchedOrder.data.cart.price) {
                        new Toast("De totaalprijs van de bestelling is gewijzigd. Je moet dit zelf communiceren naar de besteller en de betaling hiervan opvolgen indien nodig.", "warning yellow").setHide(10*1000).show();
                    }

                    this.patchOrder = this.patchOrder.patch({ data: OrderData.patch({
                        cart: clone
                    })})
                }
            })
        }).setDisplayStyle("sheet"))
    }

    async editCartItem(cartItem: CartItem ) {
        let clone = this.patchedOrder.data.cart.clone()
        const webshop = await this.webshopManager.loadWebshopIfNeeded()

        const newCartItem = cartItem.clone()

        // First refresh the item
        try {
            newCartItem.refresh(webshop)
        } catch (e) {
            Toast.fromError(e).show()
        }

        this.present(new ComponentWithProperties(CartItemView, { 
            cartItem: newCartItem, 
            oldItem: cartItem,
            cart: clone,
            webshop: webshop,
            saveHandler: (cartItem: CartItem, oldItem: CartItem | null) => {
                cartItem.validate(webshop, clone)
                if (oldItem) {
                    clone.removeItem(oldItem)
                }
                clone.addItem(cartItem)

                if (clone.price != this.patchedOrder.data.cart.price) {
                    new Toast("De totaalprijs van de bestelling is gewijzigd. Je moet dit zelf communiceren naar de besteller en de betaling hiervan opvolgen indien nodig.", "warning yellow").setHide(10*1000).show();
                }

                this.patchOrder = this.patchOrder.patch({ data: OrderData.patch({
                    cart: clone
                })})
            }
        }).setDisplayStyle("sheet"))
    }

    async deleteItem(cartItem: CartItem ) {
        if (!await CenteredMessage.confirm("Ben je zeker dat je dit wilt verwijderen?", "Ja, verwijderen", "Je kan de bestelling nog nakijken voor je het definitief verwijdert.")) {
            return
        }
        let clone = this.patchedOrder.data.cart.clone()
        clone.removeItem(cartItem)

        if (clone.price != this.patchedOrder.data.cart.price) {
            new Toast("De totaalprijs van de bestelling is gewijzigd. Je moet dit zelf communiceren naar de besteller en de betaling hiervan opvolgen indien nodig.", "warning yellow").setHide(10*1000).show();
        }

        this.patchOrder = this.patchOrder.patch({ data: OrderData.patch({
            cart: clone
        })})
    }

    get isChanged() {
        return patchContainsChanges(this.finalPatch, this.order, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.isChanged) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }
}
</script>