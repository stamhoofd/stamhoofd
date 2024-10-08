<template>
    <SaveView :title="title" class="edit-order-view" :disabled="!isChanged" :loading="saving" @save="save">
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

            <EmailInput v-model="email" title="E-mailadres" name="email" :validator="validator" :placeholder="emailPlaceholder" autocomplete="email" />
            <p v-if="emailDescription" class="style-description-small" v-text="emailDescription" />

            <PhoneInput v-if="phone || phoneEnabed" v-model="phone" :title="$t('90d84282-3274-4d85-81cd-b2ae95429c34' )" name="mobile" :validator="validator" placeholder="Optioneel voor beheerders" autocomplete="tel" :required="false" />

            <FieldBox v-for="field in fields" :key="field.id" :with-title="false" :field="field" :answers="answersClone" :error-box="errorBox" />

            <div v-for="category of recordCategories" :key="category.id" class="container">
                <hr>
                <h2>{{ category.name }}</h2>

                <RecordAnswerInput v-for="record of category.records" :key="record.id" :record-settings="record" :record-answers="recordAnswers" :validator="validator" :all-optional="true" />
            </div>

            <template v-if="checkoutMethods.length > 1">
                <hr>
                <h2>Afhaalmethode</h2>

                <STList>
                    <STListItem v-for="checkoutMethod in checkoutMethods" :key="checkoutMethod.id" :selectable="true" element-name="label" class="right-stack left-center">
                        <template #left>
                            <Radio v-model="selectedMethod" name="choose-checkout-method" :value="checkoutMethod" />
                        </template>
                        <h2 class="style-title-list">
                            {{ getTypeName(checkoutMethod.type) }}: {{ checkoutMethod.name }}
                        </h2>
                        <p class="style-description-small">
                            {{ checkoutMethod.description || checkoutMethod.address || "" }}
                        </p>
                        <p v-if="checkoutMethod.timeSlots.timeSlots.length === 1" class="style-description-small">
                            {{ capitalizeFirstLetter(formatDate(checkoutMethod.timeSlots.timeSlots[0].date)) }} tussen {{ formatMinutes(checkoutMethod.timeSlots.timeSlots[0].startTime) }} - {{ formatMinutes(checkoutMethod.timeSlots.timeSlots[0].endTime) }}
                        </p>

                        <template v-if="checkoutMethod.timeSlots.timeSlots.length === 1 && checkoutMethod.timeSlots.timeSlots[0].listedRemainingStock !== null" #right>
                            <span v-if="checkoutMethod.timeSlots.timeSlots[0].listedRemainingStock === 0" class="style-tag error">Volzet</span>
                            <span v-else class="style-tag">Nog {{ checkoutMethod.timeSlots.timeSlots[0].listedRemainingStock }} {{ checkoutMethod.timeSlots.timeSlots[0].remainingPersons !== null ? (checkoutMethod.timeSlots.timeSlots[0].listedRemainingStock === 1 ? "persoon" : "personen") : (checkoutMethod.timeSlots.timeSlots[0].listedRemainingStock === 1 ? "plaats" : "plaatsen") }}</span>
                        </template>
                    </STListItem>
                </STList>
            </template>

            <template v-if="selectedMethod && timeSlots.length > 0">
                <hr>
                <h2 v-if="selectedMethod.type === 'Takeout'">
                    Afhaaltijdstip
                </h2>
                <h2 v-else-if="selectedMethod.type === 'Delivery'">
                    Leveringstijdstip
                </h2>
                <h2 v-else-if="selectedMethod.type === 'OnSite'">
                    Tijdstip
                </h2>

                <p v-if="selectedMethod.type === 'Takeout'">
                    Afhaallocatie: {{ selectedMethod.name ? selectedMethod.name + ',' : '' }} {{ selectedMethod.address }}
                </p>

                <p v-if="selectedMethod.type === 'OnSite'">
                    Locatie: {{ selectedMethod.name ? selectedMethod.name + ',' : '' }} {{ selectedMethod.address }}
                </p>

                <STErrorsDefault :error-box="errorBox" />

                <STList>
                    <STListItem v-for="(slot, index) in timeSlots" :key="index" :selectable="true" element-name="label" class="right-stack left-center">
                        <template #left>
                            <Radio v-model="selectedSlot" name="choose-time-slot" :value="slot" />
                        </template>

                        <h2 class="style-title-list">
                            {{ formatDateWithDay(slot.date) }}
                        </h2>
                        <p class="style-description">
                            Tussen {{ formatMinutes(slot.startTime) }} - {{ formatMinutes(slot.endTime) }}
                        </p>

                        <template v-if="slot.listedRemainingStock !== null" #right>
                            <span v-if="slot.listedRemainingStock === 0" class="style-tag error">Volzet</span>
                            <span v-else class="style-tag">Nog {{ slot.listedRemainingStock }} {{ slot.remainingPersons !== null ? (slot.listedRemainingStock === 1 ? "persoon" : "personen") : (slot.listedRemainingStock === 1 ? "plaats" : "plaatsen") }}</span>
                        </template>
                    </STListItem>
                </STList>
            </template>

            <template v-if="selectedMethod && selectedMethod.type === 'Delivery'">
                <hr>
                <h2>Leveringsadres</h2>
                <div v-if="deliveryMethod && deliveryMethod.price.minimumPrice !== null && deliveryMethod.price.discountPrice !== patchedOrder.data.deliveryPrice" class="info-box">
                    Bestel minimum {{ formatPrice(deliveryMethod.price.minimumPrice) }} om van een verlaagde leveringskost van {{ formatPrice(deliveryMethod.price.discountPrice) }} te genieten.
                </div>

                <p v-if="patchedOrder.data.deliveryPrice === 0" class="success-box">
                    Levering is gratis
                    <template v-if="deliveryMethod && deliveryMethod.price.minimumPrice !== null && deliveryMethod.price.price !== 0">
                        vanaf een bestelbedrag van {{ formatPrice(deliveryMethod.price.minimumPrice) }}.
                    </template>
                </p>
                <p v-else class="info-box">
                    De leveringskost bedraagt {{ formatPrice(patchedOrder.data.deliveryPrice) }}
                    <template v-if="deliveryMethod && deliveryMethod.price.minimumPrice !== null && deliveryMethod.price.discountPrice === patchedOrder.data.deliveryPrice">
                        vanaf een bestelbedrag van {{ formatPrice(deliveryMethod.price.minimumPrice) }}.
                    </template>
                </p>

                <AddressInput v-model="address" :required="true" title="Vul het leveringsadres in" :validator="validator" :validate-server="server" />
            </template>

            <hr>
            <h2>Winkelmandje</h2>

            <p v-for="code of patchedOrder.data.discountCodes" :key="code.id" class="discount-box icon label">
                <span>Kortingscode <span class="style-discount-code">{{ code.code }}</span></span>

                <button class="button icon trash" @click="deleteCode(code)" />
            </p>

            <STList v-if="webshopFull">
                <CartItemRow v-for="cartItem of patchedOrder.data.cart.items" :key="cartItem.id" :cart-item="cartItem" :cart="patchedOrder.data.cart" :webshop="webshopFull" :editable="true" :admin="true" @edit="editCartItem(cartItem)" @delete="deleteItem(cartItem)" @amount="setCartItemAmount(cartItem, $event)" />
            </STList>

            <p v-if="(webshopFull && webshopFull.shouldEnableCart) || patchedOrder.data.cart.items.length === 0">
                <button class="button text" type="button" @click="addProduct">
                    <span class="icon add" />
                    <span>Nieuw</span>
                </button>
            </p>

            <hr>

            <PriceBreakdownBox :price-breakdown="patchedOrder.data.priceBreakown" />

            <template v-if="isNew">
                <hr>
                <h2>Betaalmethode</h2>

                <PaymentSelectionList v-model="paymentMethod" :payment-methods="paymentMethods" :organization="organization" :context="paymentContext" />
            </template>
        </template>
    </SaveView>
</template>
<script lang="ts">
import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder, patchContainsChanges } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { AddressInput, CartItemRow, CartItemView, CenteredMessage, PriceBreakdownBox, EmailInput, ErrorBox, FieldBox, LongPressDirective, PaymentSelectionList, PhoneInput, Radio, RecordAnswerInput, SaveView, STErrorsDefault, STInputBox, STList, STListItem, STNavigationBar, STToolbar, Toast, TooltipDirective, Validator } from '@stamhoofd/components';
import { I18nController } from '@stamhoofd/frontend-i18n';
import { NetworkManager } from '@stamhoofd/networking';
import { CartItem, Checkout, CheckoutMethod, CheckoutMethodType, Customer, DiscountCode, OrderData, PaymentMethod, PrivateOrder, RecordAnswer, RecordCategory, ValidatedAddress, Version, WebshopTicketType, WebshopTimeSlot } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from '@simonbackx/vue-app-navigation/classes';

import { WebshopManager } from '../WebshopManager';
import AddItemView from './AddItemView.vue';

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
        FieldBox,
        PaymentSelectionList,
        RecordAnswerInput,
        PriceBreakdownBox,
        CartItemRow,
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
        LongPress: LongPressDirective,
    },
})
export default class EditOrderView extends Mixins(NavigationMixin) {
    @Prop({ default: null })
    initialOrder!: PrivateOrder | null;

    @Prop({ required: true })
    webshopManager!: WebshopManager;

    @Prop({ default: '' })
    mode!: string;

    order: PrivateOrder = this.initialOrder ?? PrivateOrder.create({ webshopId: this.webshopManager.preview.id, id: '', payment: null });
    patchOrder: AutoEncoderPatchType<PrivateOrder> = PrivateOrder.patch({});
    errorBox: ErrorBox | null = null;
    saving = false;

    isNew = (this.initialOrder === null);

    validator = new Validator();
    answersClone = this.order.data.fieldAnswers.map(a => a.clone());
    recordAnswersClone = this.order.data.recordAnswers.map(a => a.clone());

    mounted() {
        if (this.isNew && this.checkoutMethods.length > 0) {
            // Force selection of method
            this.selectedMethod = this.checkoutMethods[0];
        }
    }

    formatFreePrice(price: number) {
        if (price === 0) {
            return '';
        }
        return Formatter.price(price);
    }

    deleteCode(code: DiscountCode) {
        const patchedData = OrderData.patch({});
        patchedData.discountCodes.addDelete(code.id);

        this.patchOrder = this.patchOrder.patch(PrivateOrder.patch({
            data: patchedData,
        }));
    }

    get recordCategories(): RecordCategory[] {
        return RecordCategory.flattenCategories(
            this.webshop.meta.recordCategories,
            this.patchedOrder.data,
        );
    }

    get phoneEnabed() {
        return this.webshop.meta.phoneEnabled;
    }

    get emailPlaceholder() {
        if (this.webshop.meta.ticketType !== WebshopTicketType.None) {
            return 'Voor tickets';
        }
        return 'Voor bevestigingsemail';
    }

    get emailDescription() {
        if (this.webshop.meta.ticketType !== WebshopTicketType.None) {
            return 'De tickets worden verzonden naar dit e-mailadres (na betaling, of meteen als betaalmethode \'Ter plaatse\' gekozen wordt). Kijk het goed na.';
        }
        return null;
    }

    get title() {
        if (this.mode === 'comments') {
            return 'Notities bewerken';
        }
        if (this.isNew) {
            return 'Nieuwe bestelling';
        }
        return 'Bestelling bewerken';
    }

    get organization() {
        return this.$organization;
    }

    get webshop() {
        return this.webshopManager.preview;
    }

    get webshopFull() {
        return this.webshopManager.webshop;
    }

    get fields() {
        return this.webshop.meta.customFields;
    }

    get finalPatch() {
        return this.patchOrder.patch(PrivateOrder.patch({
            data: OrderData.patch({
                fieldAnswers: this.answersClone,
                recordAnswers: this.recordAnswersClone as any,
            }),
        }));
    }

    get patchedOrder() {
        const patched = this.order.patch(this.finalPatch);
        if (this.webshopManager.webshop) {
            patched.data.update(this.webshopManager.webshop);
        }
        return patched;
    }

    get deliveryMethod() {
        return this.patchedOrder.data.deliveryMethod;
    }

    get paymentMethods() {
        return [PaymentMethod.Transfer, PaymentMethod.PointOfSale];
    }

    get server() {
        return NetworkManager.server;
    }

    // fields
    get firstName() {
        return this.patchedOrder.data.customer.firstName;
    }

    set firstName(firstName: string) {
        this.patchOrder = this.patchOrder.patch(PrivateOrder.patch({
            data: OrderData.patch({
                customer: Customer.patch({
                    firstName,
                }),
            }),
        }));
    }

    get lastName() {
        return this.patchedOrder.data.customer.lastName;
    }

    set lastName(lastName: string) {
        this.patchOrder = this.patchOrder.patch(PrivateOrder.patch({
            data: OrderData.patch({
                customer: Customer.patch({
                    lastName,
                }),
            }),
        }));
    }

    get email() {
        return this.patchedOrder.data.customer.email;
    }

    set email(email: string) {
        this.patchOrder = this.patchOrder.patch(PrivateOrder.patch({
            data: OrderData.patch({
                customer: Customer.patch({
                    email,
                }),
            }),
        }));
    }

    get phone() {
        return this.patchedOrder.data.customer.phone;
    }

    set phone(phone: string | null) {
        this.patchOrder = this.patchOrder.patch(PrivateOrder.patch({
            data: OrderData.patch({
                customer: Customer.patch({
                    phone: phone ?? '',
                }),
            }),
        }));
    }

    get address() {
        return this.patchedOrder.data.address;
    }

    set address(address: ValidatedAddress | null) {
        this.patchOrder = this.patchOrder.patch(PrivateOrder.patch({
            data: OrderData.patch({
                address,
            }),
        }));
    }

    get comments() {
        return this.patchedOrder.data.comments;
    }

    set comments(comments: string) {
        this.patchOrder = this.patchOrder.patch(PrivateOrder.patch({
            data: OrderData.patch({
                comments,
            }),
        }));
    }

    get checkoutMethods() {
        return this.webshop.meta.checkoutMethods;
    }

    get selectedMethod(): CheckoutMethod | null {
        if (this.patchedOrder.data.checkoutMethod) {
            const search = this.patchedOrder.data.checkoutMethod.id;
            const f = this.webshop.meta.checkoutMethods.find(c => c.id === search);
            if (f) {
                return f;
            }
        }

        // Don't return a default here: otherwise you are not able to save
        return null;
    }

    set selectedMethod(checkoutMethod: CheckoutMethod | null) {
        this.patchOrder = this.patchOrder.patch(PrivateOrder.patch({
            data: OrderData.patch({
                checkoutMethod,
            }),
        }));

        // Force update timeslot
        const temporaryVariable = this.selectedSlot;
        this.selectedSlot = temporaryVariable ?? this.timeSlots[0] ?? null;

        if (!checkoutMethod || checkoutMethod.type !== CheckoutMethodType.Delivery) {
            this.address = null;
        }
    }

    get paymentMethod() {
        return this.patchedOrder.data.paymentMethod;
    }

    set paymentMethod(paymentMethod: PaymentMethod) {
        this.patchOrder = this.patchOrder.patch(PrivateOrder.patch({
            data: OrderData.patch({
                paymentMethod,
            }),
        }));
    }

    get paymentContext() {
        return this.patchedOrder.data.paymentContext;
    }

    getTypeName(type: CheckoutMethodType) {
        switch (type) {
            case CheckoutMethodType.Takeout: return 'Afhalen';
            case CheckoutMethodType.Delivery: return 'Levering';
            case CheckoutMethodType.OnSite: return 'Ter plaatse';
        }
    }

    // Timeslots
    get timeSlots(): WebshopTimeSlot[] {
        return this.selectedMethod?.timeSlots.timeSlots.slice().sort(WebshopTimeSlot.sort) ?? [];
    }

    get selectedSlot(): WebshopTimeSlot | null {
        if (this.patchedOrder.data.timeSlot) {
            const search = this.patchedOrder.data.timeSlot;
            const f = this.timeSlots.find(c => c.id === search.id);
            if (f) {
                return f;
            }

            const f2 = this.timeSlots.find(c => c.toString() === search.toString());
            if (f2) {
                return f2;
            }
        }
        return null;
    }

    set selectedSlot(timeSlot: WebshopTimeSlot | null) {
        this.patchOrder = this.patchOrder.patch(PrivateOrder.patch({
            data: OrderData.patch({
                timeSlot,
            }),
        }));
    }

    get recordAnswers() {
        return this.recordAnswersClone;
    }

    set recordAnswers(recordAnswers: RecordAnswer[]) {
        this.recordAnswersClone = recordAnswers;
    }

    // Other

    imageSrc(cartItem: CartItem) {
        return cartItem.product.images[0]?.getPathForSize(100, 100);
    }

    async save() {
        if (this.saving) {
            return;
        }

        try {
            const isValid = await this.validator.validate();
            if (!isValid) {
                return;
            }

            await this.$nextTick();

            const orderData = this.patchedOrder.data;
            orderData.validate(this.webshopManager.webshop!, this.$organization.meta, I18nController.i18n, true);

            // Save validated record answers (to delete old answers)
            this.recordAnswersClone = orderData.recordAnswers;

            this.saving = true;

            const patch = this.finalPatch;
            patch.id = this.order.id;

            const patches: PatchableArrayAutoEncoder<PrivateOrder> = new PatchableArray();

            if (this.isNew) {
                patches.addPut(this.patchedOrder);
            }
            else {
                patches.addPatch(patch);
            }
            const orders = await this.webshopManager.patchOrders(patches);

            // Force webshop refetch to update stocks
            await this.webshopManager.loadWebshop(false);

            this.saving = false;
            new Toast('Wijzigingen opgeslagen', 'success').setHide(1000).show();

            // Move all data to original order
            for (const order of orders) {
                if (order.id === this.order.id) {
                    this.order.deepSet(order);
                }
            }
            this.patchOrder = PrivateOrder.patch({});
            this.answersClone = this.order.data.fieldAnswers.map(f => f.clone());
            this.dismiss({ force: true });
        }
        catch (e) {
            this.saving = false;
            this.errorBox = new ErrorBox(e);
        }
    }

    async addProduct() {
        let clone = this.patchedOrder.data.clone();
        const webshop = await this.webshopManager.loadWebshopIfNeeded();

        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(AddItemView, {
                checkout: clone,
                webshop: webshop,
                saveHandler: (cartItem: CartItem, oldItem: CartItem | null, component) => {
                    component.dismiss({ force: true });

                    if (oldItem) {
                        clone.cart.replaceItem(oldItem, cartItem);
                    }
                    else {
                        clone.cart.addItem(cartItem);
                    }

                    if (!this.isNew && clone.totalPrice !== this.patchedOrder.data.totalPrice) {
                        new Toast('De totaalprijs van de bestelling is gewijzigd. Je moet dit zelf communiceren naar de besteller en de betaling hiervan opvolgen indien nodig.', 'warning yellow').setHide(10 * 1000).show();
                    }

                    this.patchOrder = this.patchOrder.patch({ data: clone });
                },
            }),
        }).setDisplayStyle('sheet'));
    }

    async editCartItem(cartItem: CartItem) {
        let clone = this.patchedOrder.data.clone();
        const webshop = await this.webshopManager.loadWebshopIfNeeded();

        const newCartItem = cartItem.clone();

        // First refresh the item
        try {
            newCartItem.refresh(webshop);
        }
        catch (e) {
            Toast.fromError(e).show();
        }

        this.present({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(CartItemView, {
                        admin: true,
                        cartItem: newCartItem,
                        oldItem: cartItem,
                        checkout: clone,
                        webshop: webshop,
                        saveHandler: (cartItem: CartItem, oldItem: CartItem | null, component) => {
                            component.dismiss({ force: true });

                            if (oldItem) {
                                clone.cart.replaceItem(oldItem, cartItem);
                            }
                            else {
                                clone.cart.addItem(cartItem);
                            }

                            if (clone.totalPrice !== this.patchedOrder.data.totalPrice) {
                                new Toast('De totaalprijs van de bestelling is gewijzigd. Je moet dit zelf communiceren naar de besteller en de betaling hiervan opvolgen indien nodig.', 'warning yellow').setHide(10 * 1000).show();
                            }

                            this.patchOrder = this.patchOrder.patch({
                                data: clone,
                            });
                        },
                    }),
                }),
            ],
            modalDisplayStyle: 'sheet',
        });
    }

    async deleteItem(cartItem: CartItem) {
        if (!await CenteredMessage.confirm('Ben je zeker dat je dit wilt verwijderen?', 'Ja, verwijderen', 'Je kan de bestelling nog nakijken voor je het definitief verwijdert.')) {
            return;
        }
        let clone = this.patchedOrder.data.cart.clone();
        clone.removeItem(cartItem);

        if (clone.price !== this.patchedOrder.data.cart.price) {
            new Toast('De totaalprijs van de bestelling is gewijzigd. Je moet dit zelf communiceren naar de besteller en de betaling hiervan opvolgen indien nodig.', 'warning yellow').setHide(10 * 1000).show();
        }

        this.patchOrder = this.patchOrder.patch({ data: OrderData.patch({
            cart: clone,
        }) });
    }

    setCartItemAmount(cartItem: CartItem, amount: number) {
        let clone = this.patchedOrder.data.cart.clone();
        const found = clone.items.find(i => i.id === cartItem.id);
        if (found) {
            found.amount = amount;

            this.patchOrder = this.patchOrder.patch({ data: OrderData.patch({
                cart: clone,
            }) });
        }
    }

    get isChanged() {
        return patchContainsChanges(this.finalPatch, this.order, { version: Version });
    }

    async shouldNavigateAway() {
        if (!this.isChanged) {
            return true;
        }
        return await CenteredMessage.confirm('Ben je zeker dat je wilt sluiten zonder op te slaan?', 'Niet opslaan');
    }
}
</script>
