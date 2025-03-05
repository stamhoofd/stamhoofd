<template>
    <SaveView :title="title" class="edit-order-view" :disabled="!isChanged" :loading="saving" @save="save">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox"/>

        <template v-if="mode === 'comments'">
            <STInputBox error-fields="data.comments" :error-box="errors.errorBox" class="max">
                <textarea v-model="comments" class="input large" type="text" autocomplete="off" :placeholder="$t(`3a64a925-8a11-4a86-ae50-870ff44a7daa`)"/>
            </STInputBox>
        </template>
        <template v-else>
            <hr><h2>{{ $t('0ee592dc-991d-4ccb-acfd-2faf1bb0a479') }}</h2>

            <STInputBox error-fields="firstName,lastName" :error-box="errors.errorBox" :title="$t(`c0b0a159-8e96-40bb-84f6-dd40f579fef5`)">
                <div class="input-group">
                    <div>
                        <input v-model="firstName" class="input" name="fname" type="text" required autocomplete="given-name" :placeholder="$t(`883f9695-e18f-4df6-8c0d-651c6dd48e59`)"></div>
                    <div>
                        <input v-model="lastName" class="input" name="lname" type="text" required autocomplete="family-name" :placeholder="$t(`f89d8bfa-6b5d-444d-a40f-ec17b3f456ee`)"></div>
                </div>
            </STInputBox>

            <EmailInput v-model="email" name="email" :validator="errors.validator" :placeholder="emailPlaceholder" autocomplete="email" :title="$t(`0be79160-b242-44dd-94f0-760093f7f9f2`)"/>
            <p v-if="emailDescription" class="style-description-small" v-text="emailDescription"/>

            <PhoneInput v-if="phone || phoneEnabed" v-model="phone" :title="$t('90d84282-3274-4d85-81cd-b2ae95429c34' )" name="mobile" :validator="errors.validator" autocomplete="tel" :required="false" :placeholder="$t(`b80a01d9-140c-425b-be30-0e1a7dbb10a0`)"/>

            <FieldBox v-for="field in fields" :key="field.id" :with-title="false" :field="field" :answers="answersClone" :error-box="errors.errorBox"/>

            <div v-for="category of recordCategories" :key="category.id" class="container">
                <hr><h2>{{ category.name }}</h2>

                <RecordAnswerInput v-for="record of category.records" :key="record.id" :record="record" :answers="recordAnswers" :validator="errors.validator" :all-optional="true"/>
            </div>

            <template v-if="checkoutMethods.length > 1">
                <hr><h2>{{ $t('398b9ea9-ff06-4c5e-8457-0dfd619e2a3c') }}</h2>

                <STList>
                    <STListItem v-for="checkoutMethod in checkoutMethods" :key="checkoutMethod.id" :selectable="true" element-name="label" class="right-stack left-center">
                        <template #left>
                            <Radio v-model="selectedMethod" name="choose-checkout-method" :value="checkoutMethod"/>
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
                            <span v-if="checkoutMethod.timeSlots.timeSlots[0].listedRemainingStock === 0" class="style-tag error">{{ $t('ed9400bf-ff8e-4180-932f-3fe0347201a4') }}</span>
                            <span v-else class="style-tag">{{ $t('6878be1d-f7ca-4c4c-b6fa-de59c8028cd7') }} {{ checkoutMethod.timeSlots.timeSlots[0].listedRemainingStock }} {{ checkoutMethod.timeSlots.timeSlots[0].remainingPersons !== null ? (checkoutMethod.timeSlots.timeSlots[0].listedRemainingStock === 1 ? "persoon" : "personen") : (checkoutMethod.timeSlots.timeSlots[0].listedRemainingStock === 1 ? "plaats" : "plaatsen") }}</span>
                        </template>
                    </STListItem>
                </STList>
            </template>

            <template v-if="selectedMethod && timeSlots.length > 0">
                <hr><h2 v-if="selectedMethod.type === 'Takeout'">
                    {{ $t('bd583068-b302-4deb-a30c-22b2e084f5e7') }}
                </h2>
                <h2 v-else-if="selectedMethod.type === 'Delivery'">
                    {{ $t('d9321969-3948-418a-b59f-03a9387def23') }}
                </h2>
                <h2 v-else-if="selectedMethod.type === 'OnSite'">
                    {{ $t('93a310d9-c446-46ac-b2b6-663bfab3a0ad') }}
                </h2>

                <p v-if="selectedMethod.type === 'Takeout'">
                    {{ $t('1681f67a-bada-4fda-aa20-3ee10bab1366') }} {{ selectedMethod.name ? selectedMethod.name + ',' : '' }} {{ (selectedMethod as WebshopTakeoutMethod).address }}
                </p>

                <p v-if="selectedMethod.type === 'OnSite'">
                    {{ $t('7435ae54-2b20-4ee7-834d-66764cfdc55b') }} {{ selectedMethod.name ? selectedMethod.name + ',' : '' }} {{ (selectedMethod as WebshopOnSiteMethod).address }}
                </p>

                <STErrorsDefault :error-box="errors.errorBox"/>

                <STList>
                    <STListItem v-for="(slot, index) in timeSlots" :key="index" :selectable="true" element-name="label" class="right-stack left-center">
                        <template #left>
                            <Radio v-model="selectedSlot" name="choose-time-slot" :value="slot"/>
                        </template>

                        <h2 class="style-title-list">
                            {{ formatDateWithDay(slot.date) }}
                        </h2>
                        <p class="style-description">
                            {{ $t('31c33c73-57e4-4c3d-b2bd-05e106a1ebf6') }} {{ formatMinutes(slot.startTime) }} - {{ formatMinutes(slot.endTime) }}
                        </p>

                        <template v-if="slot.listedRemainingStock !== null" #right>
                            <span v-if="slot.listedRemainingStock === 0" class="style-tag error">{{ $t('ed9400bf-ff8e-4180-932f-3fe0347201a4') }}</span>
                            <span v-else class="style-tag">{{ $t('6878be1d-f7ca-4c4c-b6fa-de59c8028cd7') }} {{ slot.listedRemainingStock }} {{ slot.remainingPersons !== null ? (slot.listedRemainingStock === 1 ? "persoon" : "personen") : (slot.listedRemainingStock === 1 ? "plaats" : "plaatsen") }}</span>
                        </template>
                    </STListItem>
                </STList>
            </template>

            <template v-if="selectedMethod && selectedMethod.type === 'Delivery'">
                <hr><h2>{{ $t('b8166ba4-b8fb-48fe-83de-6a16572d8fc9') }}</h2>
                <div v-if="deliveryMethod && deliveryMethod.price.minimumPrice !== null && deliveryMethod.price.discountPrice !== patchedOrder.data.deliveryPrice" class="info-box">
                    {{ $t('8a0f7ea4-cfbd-4f1e-a79c-c68b5dab6d15') }} {{ formatPrice(deliveryMethod.price.minimumPrice) }} om van een verlaagde leveringskost van {{ formatPrice(deliveryMethod.price.discountPrice) }} {{ $t('9414fd6d-631e-443b-8a70-555f4a73b941') }}
                </div>

                <p v-if="patchedOrder.data.deliveryPrice === 0" class="success-box">
                    {{ $t('3681333c-99e7-41eb-ba61-183de6e2b3bf') }}
                    <template v-if="deliveryMethod && deliveryMethod.price.minimumPrice !== null && deliveryMethod.price.price !== 0">
                        {{ $t('e5f9ca0d-02be-4635-8dee-f29f42048011') }} {{ formatPrice(deliveryMethod.price.minimumPrice) }}.
                    </template>
                </p>
                <p v-else class="info-box">
                    {{ $t('5c037af2-8ec6-4f7d-9260-d493dc636a2d') }} {{ formatPrice(patchedOrder.data.deliveryPrice) }}
                    <template v-if="deliveryMethod && deliveryMethod.price.minimumPrice !== null && deliveryMethod.price.discountPrice === patchedOrder.data.deliveryPrice">
                        {{ $t('e5f9ca0d-02be-4635-8dee-f29f42048011') }} {{ formatPrice(deliveryMethod.price.minimumPrice) }}.
                    </template>
                </p>

                <AddressInput v-model="address" :required="true" :validator="errors.validator" :validate-server="server" :title="$t(`482b9f66-c75e-4ef5-a0dd-405bceccea66`)"/>
            </template>

            <hr><h2>{{ $t('608dd4a9-dbba-4c2b-818b-5e32296e7289') }}</h2>

            <p v-for="code of patchedOrder.data.discountCodes" :key="code.id" class="discount-box icon label">
                <span>{{ $t('2f4e2886-2c75-47d7-8bc4-5ace1a8d3a33') }} <span class="style-discount-code">{{ code.code }}</span></span>

                <button class="button icon trash" type="button" @click="deleteCode(code)"/>
            </p>

            <STList v-if="webshopFull">
                <CartItemRow v-for="cartItem of patchedOrder.data.cart.items" :key="cartItem.id" :cart-item="cartItem" :cart="patchedOrder.data.cart" :webshop="webshopFull" :editable="true" :admin="true" @edit="editCartItem(cartItem)" @delete="deleteItem(cartItem)" @amount="setCartItemAmount(cartItem, $event)"/>
            </STList>

            <p v-if="(webshopFull && webshopFull.shouldEnableCart) || patchedOrder.data.cart.items.length === 0">
                <button class="button text" type="button" @click="addProduct">
                    <span class="icon add"/>
                    <span>{{ $t('a5ee3e2a-e3ee-4290-af56-85a7003d9fc8') }}</span>
                </button>
            </p>

            <hr><PriceBreakdownBox :price-breakdown="patchedOrder.data.priceBreakown"/>

            <template v-if="isNew">
                <hr><h2>{{ $t('d880e10c-63f5-4a84-a994-97bbfcb04f4f') }}</h2>

                <PaymentSelectionList v-model="paymentMethod" :payment-configuration="paymentConfiguration" :organization="organization!" :context="paymentContext" :amount="patchedOrder.data.totalPrice"/>
            </template>
        </template>
    </SaveView>
</template>
<script lang="ts" setup>
import { PatchableArray, PatchableArrayAutoEncoder, patchContainsChanges } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController, useDismiss, usePresent } from '@simonbackx/vue-app-navigation';
import { AddressInput, CartItemRow, CartItemView, CenteredMessage, EmailInput, ErrorBox, FieldBox, PaymentSelectionList, PhoneInput, PriceBreakdownBox, Radio, RecordAnswerInput, SaveView, STErrorsDefault, STInputBox, STList, STListItem, Toast, useErrors, useOrganization, usePatch } from '@stamhoofd/components';
import { I18nController } from '@stamhoofd/frontend-i18n';
import { NetworkManager } from '@stamhoofd/networking';
import { CartItem, CheckoutMethod, CheckoutMethodType, Customer, DiscountCode, OrderData, PaymentConfiguration, PaymentMethod, PrivateOrder, RecordAnswer, RecordCategory, ValidatedAddress, Version, WebshopOnSiteMethod, WebshopTakeoutMethod, WebshopTicketType, WebshopTimeSlot } from '@stamhoofd/structures';

import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { WebshopManager } from '../WebshopManager';
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
const recordAnswersClone = ref(new Map([...order.data.recordAnswers].map(([id, recordAnswer]) => [id, recordAnswer.clone()])));

const finalPatch = computed(() => {
    return patchOrder.value.patch(PrivateOrder.patch({
        data: OrderData.patch({
            fieldAnswers: answersClone.value,
            recordAnswers: recordAnswersClone.value as any,
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

const recordAnswers = computed({
    get: () => recordAnswersClone.value,
    set: (recordAnswers: Map<string, RecordAnswer>) => {
        recordAnswersClone.value = recordAnswers;
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

        // Save validated record answers (to delete old answers)
        recordAnswersClone.value = orderData.recordAnswers;

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
        const orders = await props.webshopManager.patchOrders(patches);

        await props.webshopManager.storeOrders(orders);

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
    let clone = patchedOrder.value.data.clone();
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
    let clone = patchedOrder.value.data.clone();
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
    let clone = patchedOrder.value.data.cart.clone();
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
    let clone = patchedOrder.value.data.cart.clone();
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
