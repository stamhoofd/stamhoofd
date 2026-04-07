<template>
    <SaveView :title="title" class="edit-order-view" :disabled="!isChanged" :loading="saving" data-testid="edit-order-view" @save="save">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <template v-if="mode === 'comments'">
            <STInputBox error-fields="data.comments" :error-box="errors.errorBox" class="max">
                <textarea v-model="comments" class="input large" type="text" autocomplete="off" :placeholder="$t(`%Ux`)" />
            </STInputBox>
        </template>
        <template v-else>
            <hr><h2>{{ $t('%Ul') }}</h2>

            <STInputBox error-fields="firstName,lastName" :error-box="errors.errorBox" :title="$t(`%Uy`)">
                <div class="input-group">
                    <div>
                        <input v-model="firstName" class="input" name="fname" type="text" required autocomplete="given-name" :placeholder="$t(`%1MT`)" data-testid="first-name-input">
                    </div>
                    <div>
                        <input v-model="lastName" class="input" name="lname" type="text" required autocomplete="family-name" :placeholder="$t(`%1MU`)" data-testid="last-name-input">
                    </div>
                </div>
            </STInputBox>

            <EmailInput v-model="email" name="email" :validator="errors.validator" :placeholder="emailPlaceholder" autocomplete="email" :title="$t(`%1FK`)" />
            <p v-if="emailDescription" class="style-description-small" v-text="emailDescription" />

            <PhoneInput v-if="phone || phoneEnabed" v-model="phone" :title="$t('%2k' )" name="mobile" :validator="errors.validator" autocomplete="tel" :required="false" :placeholder="$t(`%Uz`)" />

            <FieldBox v-for="field in fields" :key="field.id" :with-title="false" :field="field" :answers="answersClone" :error-box="errors.errorBox" />

            <div v-for="category in recordCategories.filter(c => c.isEnabled(patchedOrder.data))" :key="category.id" class="container">
                <hr><FillRecordCategoryBox :category="category" :value="patchedOrder.data" :validator="errors.validator" :level="2" :all-optional="true" :force-mark-reviewed="true" @patch="addRecordAnswersPatch" />
            </div>

            <template v-if="checkoutMethods.length > 1">
                <hr><h2>{{ $t('%xE') }}</h2>

                <STList>
                    <STListItem v-for="checkoutMethod in checkoutMethods" :key="checkoutMethod.id" :selectable="true" element-name="label" class="right-stack left-center">
                        <template #left>
                            <Radio v-model="selectedMethod" name="choose-checkout-method" :value="checkoutMethod" />
                        </template>
                        <h2 class="style-title-list">
                            {{ getTypeName(checkoutMethod.type) }}: {{ checkoutMethod.name }}
                        </h2>
                        <p class="style-description-small">
                            {{ checkoutMethod.description || (checkoutMethod as any).address || "" }}
                        </p>
                        <p v-if="checkoutMethod.timeSlots.timeSlots.length === 1" class="style-description-small">
                            {{ capitalizeFirstLetter(formatDate(checkoutMethod.timeSlots.timeSlots[0].date)) }} tussen {{ formatMinutes(checkoutMethod.timeSlots.timeSlots[0].startTime) }} - {{ formatMinutes(checkoutMethod.timeSlots.timeSlots[0].endTime) }}
                        </p>

                        <template v-if="checkoutMethod.timeSlots.timeSlots.length === 1 && checkoutMethod.timeSlots.timeSlots[0].listedRemainingStock !== null" #right>
                            <span v-if="checkoutMethod.timeSlots.timeSlots[0].listedRemainingStock === 0" class="style-tag error">{{ $t('%Um') }}</span>
                            <span v-else class="style-tag">{{ $t('%Un') }} {{ checkoutMethod.timeSlots.timeSlots[0].listedRemainingStock }} {{ checkoutMethod.timeSlots.timeSlots[0].remainingPersons !== null ? (checkoutMethod.timeSlots.timeSlots[0].listedRemainingStock === 1 ? "persoon" : "personen") : (checkoutMethod.timeSlots.timeSlots[0].listedRemainingStock === 1 ? "plaats" : "plaatsen") }}</span>
                        </template>
                    </STListItem>
                </STList>
            </template>

            <template v-if="selectedMethod && timeSlots.length > 0">
                <hr><h2 v-if="selectedMethod.type === 'Takeout'">
                    {{ $t('%Uo') }}
                </h2>
                <h2 v-else-if="selectedMethod.type === 'Delivery'">
                    {{ $t('%Up') }}
                </h2>
                <h2 v-else-if="selectedMethod.type === 'OnSite'">
                    {{ $t('%1GD') }}
                </h2>

                <p v-if="selectedMethod.type === 'Takeout'">
                    {{ $t('%Uq') }}: {{ selectedMethod.name ? selectedMethod.name + ',' : '' }} {{ (selectedMethod as WebshopTakeoutMethod).address }}
                </p>

                <p v-if="selectedMethod.type === 'OnSite'">
                    {{ $t('%TW') }}: {{ selectedMethod.name ? selectedMethod.name + ',' : '' }} {{ (selectedMethod as WebshopOnSiteMethod).address }}
                </p>

                <STErrorsDefault :error-box="errors.errorBox" />

                <STList>
                    <STListItem v-for="(slot, index) in timeSlots" :key="index" :selectable="true" element-name="label" class="right-stack left-center">
                        <template #left>
                            <Radio v-model="selectedSlot" name="choose-time-slot" :value="slot" />
                        </template>

                        <h2 class="style-title-list">
                            {{ formatDateWithDay(slot.date) }}
                        </h2>
                        <p class="style-description">
                            {{ $t('%Ur') }} {{ formatMinutes(slot.startTime) }} - {{ formatMinutes(slot.endTime) }}
                        </p>

                        <template v-if="slot.listedRemainingStock !== null" #right>
                            <span v-if="slot.listedRemainingStock === 0" class="style-tag error">{{ $t('%Um') }}</span>
                            <span v-else class="style-tag">{{ $t('%Un') }} {{ slot.listedRemainingStock }} {{ slot.remainingPersons !== null ? (slot.listedRemainingStock === 1 ? "persoon" : "personen") : (slot.listedRemainingStock === 1 ? "plaats" : "plaatsen") }}</span>
                        </template>
                    </STListItem>
                </STList>
            </template>

            <template v-if="selectedMethod && selectedMethod.type === 'Delivery'">
                <hr><h2>{{ $t('%Us') }}</h2>
                <div v-if="deliveryMethod && deliveryMethod.price.minimumPrice !== null && deliveryMethod.price.discountPrice !== patchedOrder.data.deliveryPrice" class="info-box">
                    {{ $t('%Ut', {min: formatPrice(deliveryMethod.price.minimumPrice), price: formatPrice(deliveryMethod.price.discountPrice)}) }}
                </div>

                <p v-if="patchedOrder.data.deliveryPrice === 0" class="success-box">
                    {{ $t('%Uu') }}
                    <template v-if="deliveryMethod && deliveryMethod.price.minimumPrice !== null && deliveryMethod.price.price !== 0">
                        {{ $t('%Uv', {min: formatPrice(deliveryMethod.price.minimumPrice)}) }}
                    </template>
                </p>
                <p v-else class="info-box">
                    {{ $t('%Uw', {price: formatPrice(patchedOrder.data.deliveryPrice)}) }}
                    <template v-if="deliveryMethod && deliveryMethod.price.minimumPrice !== null && deliveryMethod.price.discountPrice === patchedOrder.data.deliveryPrice">
                        {{ $t('%Uv', {min: formatPrice(deliveryMethod.price.minimumPrice)}) }}
                    </template>
                </p>

                <AddressInput v-model="address" :required="true" :validator="errors.validator" :validate-server="server" :title="$t(`%V0`)" />
            </template>

            <hr><h2>{{ $t('%1DQ') }}</h2>

            <p v-for="code of patchedOrder.data.discountCodes" :key="code.id" class="discount-box icon label">
                <span>{{ $t('%1MX') }} <span class="style-discount-code">{{ code.code }}</span></span>

                <button class="button icon trash" type="button" @click="deleteCode(code)" />
            </p>

            <STList v-if="webshopFull">
                <CartItemRow v-for="cartItem of patchedOrder.data.cart.items" :key="cartItem.id" :cart-item="cartItem" :cart="patchedOrder.data.cart" :webshop="webshopFull" :editable="true" :admin="true" @edit="editCartItem(cartItem)" @delete="deleteItem(cartItem)" @amount="setCartItemAmount(cartItem, $event)" />
            </STList>

            <p v-if="(webshopFull && webshopFull.shouldEnableCart) || patchedOrder.data.cart.items.length === 0">
                <button class="button text" type="button" data-testid="add-product-button" @click="addProduct">
                    <span class="icon add" />
                    <span>{{ $t('%1IY') }}</span>
                </button>
            </p>

            <hr><PriceBreakdownBox :price-breakdown="patchedOrder.data.priceBreakown" />

            <template v-if="isNew">
                <hr><h2>{{ $t('%M7') }}</h2>

                <PaymentSelectionList v-model="paymentMethod" :payment-configuration="paymentConfiguration" :organization="organization!" :context="paymentContext" :amount="patchedOrder.data.totalPrice" />
            </template>
        </template>
    </SaveView>
</template>
<script lang="ts" setup>
import type { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray, patchContainsChanges } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController, useDismiss, usePresent } from '@simonbackx/vue-app-navigation';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { useOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import { usePatch } from '@stamhoofd/components/hooks/usePatch.ts';
import AddressInput from '@stamhoofd/components/inputs/AddressInput.vue';
import EmailInput from '@stamhoofd/components/inputs/EmailInput.vue';
import PhoneInput from '@stamhoofd/components/inputs/PhoneInput.vue';
import Radio from '@stamhoofd/components/inputs/Radio.vue';
import STInputBox from '@stamhoofd/components/inputs/STInputBox.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import FillRecordCategoryBox from '@stamhoofd/components/records/components/FillRecordCategoryBox.vue';
import CartItemRow from '@stamhoofd/components/views/CartItemRow.vue';
import CartItemView from '@stamhoofd/components/views/CartItemView.vue';
import FieldBox from '@stamhoofd/components/views/FieldBox.vue';
import PaymentSelectionList from '@stamhoofd/components/views/PaymentSelectionList.vue';
import PriceBreakdownBox from '@stamhoofd/components/views/PriceBreakdownBox.vue';
import { I18nController } from '@stamhoofd/frontend-i18n/I18nController';
import { NetworkManager } from '@stamhoofd/networking/NetworkManager';
import type { CartItem, CheckoutMethod, DiscountCode, PatchAnswers, ValidatedAddress, WebshopOnSiteMethod, WebshopTakeoutMethod } from '@stamhoofd/structures';
import { CheckoutMethodType, Customer, OrderData, PaymentConfiguration, PaymentMethod, PrivateOrder, RecordCategory, Version, WebshopTicketType, WebshopTimeSlot } from '@stamhoofd/structures';

import { computed, nextTick, onMounted, ref, watch } from 'vue';
import type { WebshopManager } from '../WebshopManager';
import AddItemView from './AddItemView.vue';

const props = withDefaults(defineProps<{
    initialOrder?: PrivateOrder | null;
    webshopManager: WebshopManager;
    mode?: string;
}>(), {
    initialOrder: null,
    mode: '',
});

const organization = useOrganization();
const order = props.initialOrder ?? PrivateOrder.create({ webshopId: props.webshopManager.preview.id, id: '', payment: null });
const { patch: patchOrder, addPatch } = usePatch(order);
const present = usePresent();
const dismiss = useDismiss();

const answersClone = ref(order.data.fieldAnswers.map(a => a.clone()));

const finalPatch = computed(() => {
    return patchOrder.value.patch(PrivateOrder.patch({
        data: OrderData.patch({
            fieldAnswers: answersClone.value,
        }),
    }));
});

const patchedOrder = computed(() => {
    return order.patch(finalPatch.value);
});

watch(patchedOrder, (p) => {
    if (props.webshopManager.webshop) {
        p.data.update(props.webshopManager.webshop);
    }
});

const isChanged = computed(() => patchContainsChanges(finalPatch.value, order, { version: Version }));

const errors = useErrors();
const saving = ref(false);
const isNew = props.initialOrder === null;

onMounted(() => {
    if (isNew && checkoutMethods.value.length > 0) {
        // Force selection of method
        selectedMethod.value = checkoutMethods.value[0];
    }
});

function deleteCode(code: DiscountCode) {
    const patchedData = OrderData.patch({});
    patchedData.discountCodes.addDelete(code.id);

    addPatch({ data: patchedData });
}

const recordCategories = computed(() => {
    return RecordCategory.flattenCategories(
        webshop.meta.recordCategories,
        patchedOrder.value.data,
    );
});

const phoneEnabed = computed(() => {
    return webshop.meta.phoneEnabled;
});

const emailPlaceholder = computed(() => {
    if (webshop.meta.ticketType !== WebshopTicketType.None) {
        return 'Voor tickets';
    }
    return 'Voor bevestigingsemail';
});

const emailDescription = computed(() => {
    if (webshop.meta.ticketType !== WebshopTicketType.None) {
        return 'De tickets worden verzonden naar dit e-mailadres (na betaling, of meteen als betaalmethode \'Ter plaatse\' gekozen wordt). Kijk het goed na.';
    }
    return null;
});

const title = computed(() => {
    if (props.mode === 'comments') {
        return 'Notities bewerken';
    }
    if (isNew) {
        return 'Nieuwe bestelling';
    }
    return 'Bestelling bewerken';
});

const webshop = props.webshopManager.preview;
const webshopFull = props.webshopManager.webshop;
const fields = webshop.meta.customFields;
const deliveryMethod = computed(() => patchedOrder.value.data.deliveryMethod);
const paymentConfiguration = PaymentConfiguration.create({
    ...webshop.meta.paymentConfiguration,
    paymentMethods: [PaymentMethod.Transfer, PaymentMethod.PointOfSale],
});

const server = NetworkManager.server;

const firstName = computed({
    get: () => patchedOrder.value.data.customer.firstName,
    set: (firstName: string) => {
        addPatch({
            data: OrderData.patch({
                customer: Customer.patch({
                    firstName,
                }),
            }),
        });
    },

});

const lastName = computed({
    get: () => patchedOrder.value.data.customer.lastName,
    set: (lastName: string) => {
        addPatch({
            data: OrderData.patch({
                customer: Customer.patch({
                    lastName,
                }),
            }),
        });
    },
});

const email = computed({
    get: () => patchedOrder.value.data.customer.email,
    set: (email: string) => {
        addPatch({
            data: OrderData.patch({
                customer: Customer.patch({
                    email,
                }),
            }),
        });
    },
});

const phone = computed({
    get: () => patchedOrder.value.data.customer.phone,
    set: (phone: string | null) => {
        addPatch({
            data: OrderData.patch({
                customer: Customer.patch({
                    phone: phone ?? '',
                }),
            }),
        });
    },
});

const address = computed({
    get: () => patchedOrder.value.data.address,
    set: (address: ValidatedAddress | null) => {
        addPatch({
            data: OrderData.patch({
                address,
            }),
        });
    },
});

const comments = computed({
    get: () => patchedOrder.value.data.comments,
    set: (comments: string) => {
        addPatch({
            data: OrderData.patch({
                comments,
            }),
        });
    },
});

function addRecordAnswersPatch(patch: PatchAnswers) {
    console.log('Add patch', patch);
    addPatch({
        data: OrderData.patch({
            recordAnswers: patch,
        }),
    });
}

const checkoutMethods = computed(() => webshop.meta.checkoutMethods);

const selectedMethod = computed({
    get: () => {
        if (patchedOrder.value.data.checkoutMethod) {
            const search = patchedOrder.value.data.checkoutMethod.id;
            const f = webshop.meta.checkoutMethods.find(c => c.id === search);
            if (f) {
                return f;
            }
        }

        // Don't return a default here: otherwise you are not able to save
        return null;
    },
    set: (checkoutMethod: CheckoutMethod | null) => {
        addPatch({
            data: OrderData.patch({
                checkoutMethod,
            }),
        });

        // Force update timeslot
        const temporaryVariable = selectedSlot.value;
        selectedSlot.value = temporaryVariable ?? timeSlots.value[0] ?? null;

        if (!checkoutMethod || checkoutMethod.type !== CheckoutMethodType.Delivery) {
            address.value = null;
        }
    },
});

const paymentMethod = computed({
    get: () => patchedOrder.value.data.paymentMethod,
    set: (paymentMethod: PaymentMethod) => {
        addPatch({
            data: OrderData.patch({
                paymentMethod,
            }),
        });
    },
});

const paymentContext = computed(() => patchedOrder.value.data.paymentContext);

function getTypeName(type: CheckoutMethodType) {
    switch (type) {
        case CheckoutMethodType.Takeout: return 'Afhalen';
        case CheckoutMethodType.Delivery: return 'Levering';
        case CheckoutMethodType.OnSite: return 'Ter plaatse';
    }
}

const timeSlots = computed(() => selectedMethod.value?.timeSlots.timeSlots.slice().sort(WebshopTimeSlot.sort) ?? []);

const selectedSlot = computed({
    get: () => {
        if (patchedOrder.value.data.timeSlot) {
            const search = patchedOrder.value.data.timeSlot;
            const f = timeSlots.value.find(c => c.id === search.id);
            if (f) {
                return f;
            }

            const f2 = timeSlots.value.find(c => c.toString() === search.toString());
            if (f2) {
                return f2;
            }
        }
        return null;
    },
    set: (timeSlot: WebshopTimeSlot | null) => {
        addPatch({
            data: OrderData.patch({
                timeSlot,
            }),
        });
    },
});

// Other
async function save() {
    if (saving.value) {
        return;
    }

    try {
        const isValid = await errors.validator.validate();
        if (!isValid) {
            return;
        }

        await nextTick();

        const orderData = patchedOrder.value.data;
        orderData.validate(props.webshopManager.webshop!, organization.value!.meta, I18nController.i18n, true);

        saving.value = true;

        const patch = finalPatch.value;
        patch.id = order.id;

        const patches: PatchableArrayAutoEncoder<PrivateOrder> = new PatchableArray();

        if (isNew) {
            patches.addPut(patchedOrder.value);
        }
        else {
            patches.addPatch(patch);
        }

        const orders = await props.webshopManager.orders.putPatches(patches);

        // Force webshop refetch to update stocks
        await props.webshopManager.loadWebshop(false);

        saving.value = false;
        new Toast('Wijzigingen opgeslagen', 'success').setHide(1000).show();

        // Move all data to original order
        for (const receivedOrder of orders) {
            if (receivedOrder.id === order.id) {
                order.deepSet(receivedOrder);
            }
        }
        patchOrder.value = PrivateOrder.patch({});
        answersClone.value = order.data.fieldAnswers.map(f => f.clone());
        dismiss({ force: true }).catch(console.error);
    }
    catch (e) {
        saving.value = false;
        errors.errorBox = new ErrorBox(e);
    }
}

async function addProduct() {
    const clone = patchedOrder.value.data.clone();

    const w = await props.webshopManager.loadWebshopIfNeeded();

    present(new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(AddItemView, {
            checkout: clone,
            webshop: w,
            saveHandler: (cartItem: CartItem, oldItem: CartItem | null, component: any) => {
                component.dismiss({ force: true });

                if (oldItem) {
                    clone.cart.replaceItem(oldItem, cartItem);
                }
                else {
                    clone.cart.addItem(cartItem);
                }

                if (!isNew && clone.totalPrice !== patchedOrder.value.data.totalPrice) {
                    new Toast('De totaalprijs van de bestelling is gewijzigd. Je moet dit zelf communiceren naar de besteller en de betaling hiervan opvolgen indien nodig.', 'warning yellow').setHide(10 * 1000).show();
                }

                patchOrder.value = patchOrder.value.patch({ data: clone });
            },
        }),
    }).setDisplayStyle('sheet')).catch(console.error);
}

async function editCartItem(cartItem: CartItem) {
    const clone = patchedOrder.value.data.clone();
    const w = await props.webshopManager.loadWebshopIfNeeded();

    const newCartItem = cartItem.clone();

    // First refresh the item
    try {
        newCartItem.refresh(w);
    }
    catch (e) {
        Toast.fromError(e).show();
    }

    present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(CartItemView, {
                    admin: true,
                    cartItem: newCartItem,
                    oldItem: cartItem,
                    checkout: clone,
                    webshop: w,
                    saveHandler: (cartItem: CartItem, oldItem: CartItem | null, component: any) => {
                        component.dismiss({ force: true });

                        if (oldItem) {
                            clone.cart.replaceItem(oldItem, cartItem);
                        }
                        else {
                            clone.cart.addItem(cartItem);
                        }

                        if (clone.totalPrice !== patchedOrder.value.data.totalPrice) {
                            new Toast('De totaalprijs van de bestelling is gewijzigd. Je moet dit zelf communiceren naar de besteller en de betaling hiervan opvolgen indien nodig.', 'warning yellow').setHide(10 * 1000).show();
                        }

                        patchOrder.value = patchOrder.value.patch({
                            data: clone,
                        });
                    },
                }),
            }),
        ],
        modalDisplayStyle: 'sheet',
    }).catch(console.error);
}

async function deleteItem(cartItem: CartItem) {
    if (!await CenteredMessage.confirm('Ben je zeker dat je dit wilt verwijderen?', 'Ja, verwijderen', 'Je kan de bestelling nog nakijken voor je het definitief verwijdert.')) {
        return;
    }
    const clone = patchedOrder.value.data.cart.clone();
    clone.removeItem(cartItem);

    if (clone.price !== patchedOrder.value.data.cart.price) {
        new Toast('De totaalprijs van de bestelling is gewijzigd. Je moet dit zelf communiceren naar de besteller en de betaling hiervan opvolgen indien nodig.', 'warning yellow').setHide(10 * 1000).show();
    }

    addPatch({
        data: OrderData.patch({
            cart: clone,
        }),
    });
}

function setCartItemAmount(cartItem: CartItem, amount: number) {
    const clone = patchedOrder.value.data.cart.clone();
    const found = clone.items.find(i => i.id === cartItem.id);
    if (found) {
        found.amount = amount;

        addPatch({
            data: OrderData.patch({
                cart: clone,
            }),
        });
    }
}

async function shouldNavigateAway() {
    if (!isChanged.value) {
        return true;
    }
    return await CenteredMessage.confirm('Ben je zeker dat je wilt sluiten zonder op te slaan?', 'Niet opslaan');
}

defineExpose({
    shouldNavigateAway,
});
</script>
