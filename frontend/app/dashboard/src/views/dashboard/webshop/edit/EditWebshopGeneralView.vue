<template>
    <SaveView :title="viewTitle" :save-text="isNew ? $t('Aanmaken') : $t('Opslaan')" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>{{ viewTitle }}</h1>
        <STErrorsDefault :error-box="errors.errorBox" />

        <!-- name -->
        <STInputBox error-fields="meta.name" :error-box="errors.errorBox" :title="$t(`Naam`)">
            <input v-model="name" class="input" type="text" autocomplete="off" :placeholder="namePlaceholder">
        </STInputBox>

        <p v-if="name.length > 30 && isNew" class="style-description-small">
            Lange naam? Je kan de zichtbare titel straks wijzigen bij de instellingen 'Personaliseren'. Hier houd je het beter kort.
        </p>
        <p v-else-if="name.length > 30" class="style-description-small">
            {{ $t("%Qm") }}
        </p>

        <!-- type -->
        <template v-if="forceType === null || type !== forceType">
            <STInputBox title="Type" error-fields="type" :error-box="errors.errorBox" class="max">
                <div class="illustration-radio-container">
                    <label class="illustration-radio-box">
                        <div>
                            <Radio v-model="type" :value="WebshopType.Performance" />
                        </div>
                        <figure>
                            <img src="~@stamhoofd/assets/images/illustrations/stage.svg">
                        </figure>
                        <h3>Zaalvoorstelling</h3>
                        <p>Met tickets en vaste plaatsen</p>
                    </label>

                    <label class="illustration-radio-box">
                        <div>
                            <Radio v-model="type" :value="WebshopType.Event" />
                        </div>
                        <figure>
                            <img src="~@stamhoofd/assets/images/illustrations/tickets.svg">
                        </figure>
                        <h3>Evenement met tickets</h3>
                        <p>Fuif, festival, ...</p>
                    </label>

                    <label class="illustration-radio-box">
                        <div>
                            <Radio v-model="type" :value="WebshopType.Registrations" />
                        </div>
                        <figure>
                            <img src="~@stamhoofd/assets/images/illustrations/edit-data.svg">
                        </figure>
                        <h3>Inschrijvingen</h3>
                        <p>Quiz, wandeltocht, eetfestijn, lessen, workshop...</p>
                    </label>

                    <label class="illustration-radio-box">
                        <div>
                            <Radio v-model="type" :value="WebshopType.TakeawayAndDelivery" />
                        </div>
                        <figure>
                            <img src="~@stamhoofd/assets/images/illustrations/truck.svg">
                        </figure>
                        <h3>Take-away of levering</h3>
                    </label>

                    <label class="illustration-radio-box">
                        <div>
                            <Radio v-model="type" :value="WebshopType.Donations" />
                        </div>
                        <figure>
                            <img src="~@stamhoofd/assets/images/illustrations/charity.svg">
                        </figure>
                        <h3>Donaties of inzameling</h3>
                    </label>

                    <label class="illustration-radio-box">
                        <div>
                            <Radio v-model="type" :value="WebshopType.Webshop" />
                        </div>
                        <figure>
                            <img src="~@stamhoofd/assets/images/illustrations/cart.svg">
                        </figure>
                        <h3>Webshop / andere</h3>
                    </label>
                </div>
            </STInputBox>
            <p v-if="isNew" class="style-description-small">
                Via het type van je webshop helpen we later makkelijk op weg.
            </p>
        </template>

        <!-- ticket access control -->
        <template v-if="accessControlList.length > 1">
            <STInputBox :title="accessControlLabel" error-fields="type" :error-box="errors.errorBox" class="max">
                <div class="illustration-radio-container">
                    <label v-for="option in accessControlList" :key="option.value" class="illustration-radio-box">
                        <div>
                            <Radio v-model="ticketType" :value="option.value" />
                        </div>
                        <figure>
                            <img :src="option.src">
                        </figure>
                        <h3>{{ option.label }}</h3>
                        <p v-if="option.tag"><span class="style-tag">{{ option.tag }}</span></p>
                        <p v-if="option.description">{{ option.description }}</p>

                    </label>
                </div>
            </STInputBox>
            <p v-if="ticketType === WebshopTicketType.SingleTicket" class="info-box">
                {{ $t("%Qn") }}
            </p>
            <p v-if="ticketType === WebshopTicketType.Tickets" class="info-box">
                {{ $t('%QY') }}
            </p>
        </template>

        <template v-if="!isNew">
            <!-- availability -->
            <hr><h2>{{ $t('%1CP') }}</h2>

            <Checkbox v-model="hasStatusClosed">
                {{ $t('%CZ') }}
            </Checkbox>

            <template v-if="!hasStatusClosed">
                <Checkbox v-model="useAvailableUntil">
                    {{ $t('%QZ') }}
                </Checkbox>
                <div v-if="useAvailableUntil" class="split-inputs">
                    <STInputBox error-fields="settings.availableUntil" :error-box="errors.errorBox" :title="$t(`%Qq`)">
                        <DateSelection v-model="availableUntil" />
                    </STInputBox>
                    <TimeInput v-model="availableUntil" :validator="errors.validator" :title="$t(`%Qr`)" />
                </div>
                <Checkbox v-model="useOpenAt">
                    {{ $t('%Qa') }}
                </Checkbox>
                <div v-if="useOpenAt" class="split-inputs">
                    <STInputBox error-fields="settings.openAt" :error-box="errors.errorBox" :title="$t(`%Qs`)">
                        <DateSelection v-model="openAt" />
                    </STInputBox>
                    <TimeInput v-model="openAt" :validator="errors.validator" :title="$t(`%Qr`)" />
                </div>
            </template>

            <!-- numbering -->
            <div class="container">
                <hr><h2>{{ $t('%Qb') }}</h2>

                <STList>
                    <STListItem :selectable="true" element-name="label" class="left-center">
                        <template #left>
                            <Radio v-model="numberingType" :value="WebshopNumberingType.Continuous" />
                        </template>
                        <h3 class="style-title-list">
                            {{ $t('%Qc') }}
                        </h3>
                        <p class="style-description">
                            {{ $t('%29') }}
                        </p>
                    </STListItem>
                    <STListItem :selectable="true" element-name="label" class="left-center">
                        <template #left>
                            <Radio v-model="numberingType" :value="WebshopNumberingType.Random" />
                        </template>
                        <h3 class="style-title-list">
                            {{ $t('%Qd') }}
                        </h3>
                        <p class="style-description">
                            {{ $t('%1L') }}
                        </p>
                    </STListItem>
                </STList>

                <STInputBox v-if="numberingType === WebshopNumberingType.Continuous" error-fields="settings.openAt" :error-box="errors.errorBox" :title="$t(`%Qt`)">
                    <NumberInput v-model="startNumber" :min="1" :max="100000000 - 100000" />
                </STInputBox>
                <p v-if="!isNew && numberingType === WebshopNumberingType.Continuous" class="style-description-small">
                    {{ $t('%Qe') }}
                </p>
            </div>
        </template>

        <!-- payment methods -->
        <div v-if="stripeAccountObject || hasPayconiq || hasMollieOrBuckaroo" class="container">
            <hr><h2>{{ $t('%O7') }}</h2>
            <p>{{ $t('%Qf') }} <a class="inline-link" :href="$domains.getDocs('betaalmethodes-voor-webshops-instellen')" target="_blank">{{ $t('%OH') }}</a>.</p>

            <EditPaymentMethodsBox type="webshop" :organization="organization" :config="config" :private-config="privateConfig" :validator="errors.validator" @patch:config="patchConfig($event)" @patch:private-config="patchPrivateConfig($event)" />
        </div>

        <div v-if="getFeatureFlag('webshop-auth')" class="container">
            <hr><h2>{{ $t('%Qg') }}</h2>
            <p>
                {{ $t('%Qh') }}
            </p>

            <STList>
                <STListItem :selectable="true" element-name="label" class="left-center">
                    <template #left>
                        <Radio v-model="authType" :value="WebshopAuthType.Disabled" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('%Qi') }}
                    </h3>
                    <p class="style-description">
                        {{ $t('%Qj') }}
                    </p>
                </STListItem>
                <STListItem :selectable="true" element-name="label" class="left-center">
                    <template #left>
                        <Radio v-model="authType" :value="WebshopAuthType.Required" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('%Qk') }}
                    </h3>
                    <p class="style-description">
                        {{ $t('%Ql') }}
                    </p>
                </STListItem>
            </STList>
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import { ArrayDecoder, AutoEncoderPatchType, Decoder, PatchableArray } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import listIllustrationSrc from '@stamhoofd/assets/images/illustrations/list.svg';
import scannerIllustrationSrc from '@stamhoofd/assets/images/illustrations/scanner.svg';
import teamIllustrationSrc from '@stamhoofd/assets/images/illustrations/team.svg';
import userIllustrationSrc from '@stamhoofd/assets/images/illustrations/user.svg';
import { useRequiredOrganization } from '@stamhoofd/components';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import Checkbox from '@stamhoofd/components/inputs/Checkbox.vue';
import DateSelection from '@stamhoofd/components/inputs/DateSelection.vue';
import NumberInput from '@stamhoofd/components/inputs/NumberInput.vue';
import Radio from '@stamhoofd/components/inputs/Radio.vue';
import STInputBox from '@stamhoofd/components/inputs/STInputBox.vue';
import TimeInput from '@stamhoofd/components/inputs/TimeInput.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { I18nController } from '@stamhoofd/frontend-i18n';
import { useRequestOwner } from '@stamhoofd/networking';
import { Country, PaymentConfiguration, PaymentMethod, PaymentMethodHelper, PrivatePaymentConfiguration, PrivateWebshop, Product, ProductType, StripeAccount, WebshopAuthType, WebshopMetaData, WebshopNumberingType, WebshopPrivateMetaData, WebshopStatus, WebshopTicketType, WebshopType } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';
import { computed, nextTick, ref } from 'vue';
import EditPaymentMethodsBox from '../../../../components/EditPaymentMethodsBox.vue';
import { useEditWebshop, UseEditWebshopProps } from './useEditWebshop';

const props = withDefaults(defineProps<UseEditWebshopProps & { forceType: WebshopType | null }>(), { forceType: null });

const { isNew, webshop, addPatch, patch: webshopPatch, originalWebshop, errors, saving, save, hasChanges, shouldNavigateAway } = useEditWebshop({
    getProps: () => props,
    validate: () => {
        if (webshop.value.meta.name.trim().length === 0) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Name is empty',
                human: 'Vul een naam in voor jouw webshop voor je doorgaat',
                field: 'meta.name',
            });
        }
    },
});
const context = useContext();
const owner = useRequestOwner();
const organization = useRequiredOrganization();

const viewTitle = computed(() => {
    if (props.forceType) {
        switch (props.forceType) {
            case WebshopType.Performance:
                return 'Nieuwe zaalvoorstelling';
            case WebshopType.Event:
                return 'Nieuw evenement met tickets';
            case WebshopType.Registrations:
                return 'Nieuwe inschrijvingen';
            case WebshopType.TakeawayAndDelivery:
                return 'Nieuwe take-away of levering';
            case WebshopType.Donations:
                return 'Nieuwe inzameling';
            default:
                return 'Nieuwe webshop';
        }
    }

    if (isNew.value) {
        return 'Nieuwe verkoop, inschrijvingsformulier of geldinzameling starten';
    }
    return 'Algemene instellingen';
});

const name = computed({
    get: () => webshop.value.meta.name,
    set: (name: string) => addPatch(PrivateWebshop.patch({ meta: WebshopMetaData.patch({ name }) })),
});

const namePlaceholder = computed(() => {
    switch (type.value) {
        case WebshopType.Performance:
            return "Bv. 'Schaduwen van morgen'";
        case WebshopType.Event:
            return 'Bv. Ruimtefestival';
        case WebshopType.Registrations:
            return 'Bv. Eetfestijn';
        case WebshopType.TakeawayAndDelivery:
            return 'bv. Wijnverkoop';
        case WebshopType.Donations:
            return 'bv. Inzameling nieuw materiaal';
        default:
            return 'Bv. T-shirts';
    }
});

const ticketType = computed({
    get: () => webshop.value.meta.ticketType,
    set: (ticketType: WebshopTicketType) => {
        const patch = WebshopMetaData.patch({ ticketType });
        const p = PrivateWebshop.patch({ meta: patch });

        // Restore any chagnes to locations
        if (webshopPatch.value.meta) {
            webshopPatch.value.meta.checkoutMethods = patch.checkoutMethods;
        }

        // Restore any changes to products
        if (webshopPatch.value) {
            webshopPatch.value.products = p.products;
        }

        if (ticketType === WebshopTicketType.Tickets) {
            let used = false;
            // Update all products to not ticket or voucher if needed
            for (const product of webshop.value.products) {
                if (product.type !== ProductType.Ticket && product.type !== ProductType.Voucher) {
                    const productPatch = Product.patch({
                        id: product.id,
                        type: ProductType.Ticket,
                    });
                    p.products.addPatch(productPatch);
                    used = true;
                }
            }

            if (used) {
                new Toast('Sommige artikelen zullen worden omgezet in tickets waardoor je hun locatie en datum nog zal moeten invullen', 'warning yellow').setHide(null).show();
            }

            // Remove all locations
            let deletedLocation = false;
            for (const location of webshop.value.meta.checkoutMethods) {
                patch.checkoutMethods.addDelete(location.id);
                deletedLocation = true;
            }

            if (deletedLocation) {
                new Toast('Alle afhaal- en leveringslocaties zullen worden verwijderd als je opslaat omdat deze niet ondersteund worden bij een ticketverkoop voor personen', 'warning yellow').setHide(null).show();
            }
        }
        else {
            let used = false;
            // Update all products to not ticket or voucher if needed
            for (const product of webshop.value.products) {
                if (product.type === ProductType.Ticket || product.type === ProductType.Voucher) {
                    const productPatch = Product.patch({
                        id: product.id,
                        type: ProductType.Product,
                        location: null,
                        dateRange: null,
                    });
                    p.products.addPatch(productPatch);
                    used = true;
                }
            }

            if (used) {
                new Toast('Sommige tickets zullen worden omgezet in gewone artikels waardoor hun locatie en datum informatie verloren gaat als je nu opslaat.', 'warning yellow').setHide(null).show();
            }
        }

        addPatch(p);
    },
});

const accessControlLabel = computed(() => {
    if (webshop.value.meta.type === WebshopType.Webshop || webshop.value.meta.type === WebshopType.TakeawayAndDelivery) {
        return 'Controle bij afhalen/leveren';
    }
    return 'Toegangscontrole';
});

const accessControlList = computed<{ label: string; value: WebshopTicketType; src: string; tag?: string; description?: string }[]>(() => {
    if (webshop.value.meta.type === WebshopType.Webshop
        || webshop.value.meta.type === WebshopType.TakeawayAndDelivery
    ) {
        return [
            {
                label: 'Zonder scanners',
                value: WebshopTicketType.None,
                src: listIllustrationSrc,
                tag: 'Meest gekozen',
            },
            {
                label: 'Bestelling scannen',
                value: WebshopTicketType.SingleTicket,
                src: scannerIllustrationSrc,
            },
        ];
    }

    if (webshop.value.meta.type === WebshopType.Donations) {
        return [
            {
                label: 'Zonder scannen',
                value: WebshopTicketType.None,
                src: listIllustrationSrc,
            },
        ];
    }

    if (webshop.value.meta.type === WebshopType.Performance) {
        return [
            {
                label: 'Ticket per persoon',
                value: WebshopTicketType.Tickets,
                src: teamIllustrationSrc,
            },
        ];
    }

    const list: { label: string; value: WebshopTicketType; src: string; tag?: string; description?: string }[] = [];

    if (webshop.value.meta.type !== WebshopType.Event) {
        list.push({
            label: 'Zonder scanners',
            value: WebshopTicketType.None,
            src: listIllustrationSrc,
            tag: 'Meest gekozen',
        });
    }

    return [
        ...list,
        {
            label: 'Ticket per persoon',
            value: WebshopTicketType.Tickets,
            src: userIllustrationSrc,
            tag: list.length === 0 ? 'Meest gekozen' : undefined,
        },
        {
            label: 'Ticket per bestelling',
            value: WebshopTicketType.SingleTicket,
            src: teamIllustrationSrc,
        },
    ];
});

const type = computed({
    get: () => webshop.value.meta.type,
    set: (value: WebshopType) => {
        if (value === type.value) {
            return;
        }
        const patch = WebshopMetaData.patch({ type: value });
        addPatch(PrivateWebshop.patch({ meta: patch }));

        // If changed to original type again
        if (value === originalWebshop.meta.type) {
            // Change back to original ticket type
            ticketType.value = originalWebshop.meta.ticketType;
            return;
        }

        // todo: watch instead of next tick?
        nextTick(() => {
            const list = accessControlList.value;
            if (list.length > 0) {
                const initialType = originalWebshop.meta.ticketType;
                const found2 = list.find(i => i.value === initialType);
                if (found2 && !isNew.value) {
                    ticketType.value = initialType;
                    return;
                }

                const found = list.find(i => i.value === ticketType.value);
                if (!found) {
                    ticketType.value = list[0].value;
                }
            }
        }).catch(console.error);
    },
});

const numberingType = computed({
    get: () => webshop.value.privateMeta.numberingType,
    set: (numberingType: WebshopNumberingType) => {
        const patch = WebshopPrivateMetaData.patch({ numberingType });
        addPatch(PrivateWebshop.patch({ privateMeta: patch }));
    },
});

const authType = computed({
    get: () => webshop.value.meta.authType,
    set: (authType: WebshopAuthType) => {
        const patch = WebshopMetaData.patch({ authType });
        addPatch(PrivateWebshop.patch({ meta: patch }));
    },
});

const startNumber = computed({
    get: () => webshop.value.privateMeta.startNumber,
    set: (startNumber: number) => {
        addPatch(PrivateWebshop.patch({ privateMeta: WebshopPrivateMetaData.patch({ startNumber }) }));
    },
});

const availableUntil = computed({
    get: () => webshop.value.meta.availableUntil ?? new Date(),
    set: (availableUntil: Date) => {
        const p = PrivateWebshop.patch({});
        const meta = WebshopMetaData.patch({});
        meta.availableUntil = availableUntil;
        p.meta = meta;
        addPatch(p);
    },
});

const useAvailableUntil = computed({
    get: () => webshop.value.meta.availableUntil !== null,
    set: (use: boolean) => {
        if (use === useAvailableUntil.value) {
            return;
        }
        const p = PrivateWebshop.patch({});
        const meta = WebshopMetaData.patch({});
        if (use) {
            meta.availableUntil = new Date();
        }
        else {
            meta.availableUntil = null;
        }
        p.meta = meta;
        addPatch(p);
    },
});

const hasStatusClosed = computed({
    get: () => webshop.value.meta.status === WebshopStatus.Closed,
    set: (value: boolean) => {
        const status = value ? WebshopStatus.Closed : WebshopStatus.Open;
        addPatch(PrivateWebshop.patch({ meta: WebshopMetaData.patch({ status }) }));
    },
});

const useOpenAt = computed({
    get: () => webshop.value.meta.openAt !== null,
    set: (use: boolean) => {
        if (use === useOpenAt.value) {
            return;
        }
        const p = PrivateWebshop.patch({});
        const meta = WebshopMetaData.patch({});
        if (use) {
            meta.openAt = new Date();
        }
        else {
            meta.openAt = null;
        }
        p.meta = meta;
        addPatch(p);
    },
});

const openAt = computed({
    get: () => webshop.value.meta.openAt ?? new Date(),
    set: (openAt: Date) => {
        const p = PrivateWebshop.patch({});
        const meta = WebshopMetaData.patch({});
        meta.openAt = openAt;
        p.meta = meta;
        addPatch(p);
    },
});

const config = computed(() => webshop.value.meta.paymentConfiguration);

function patchConfig(patch: AutoEncoderPatchType<PaymentConfiguration>) {
    addPatch(
        PrivateWebshop.patch({
            meta: WebshopMetaData.patch({
                paymentConfiguration: patch,
            }),
        }),
    );
}

const privateConfig = computed(() => webshop.value.privateMeta.paymentConfiguration);

function patchPrivateConfig(patch: PrivatePaymentConfiguration | AutoEncoderPatchType<PrivatePaymentConfiguration>) {
    addPatch(
        PrivateWebshop.patch({
            privateMeta: WebshopPrivateMetaData.patch({
                paymentConfiguration: patch,
            }),
        }),
    );
}

function getFeatureFlag(flag: string) {
    return organization.value?.privateMeta?.featureFlags.includes(flag) ?? false;
}

const stripeAccounts = ref<StripeAccount[]>([]);

const stripeAccountObject = computed(() => {
    return stripeAccounts.value.find(a => a.id === stripeAccountId.value) ?? null;
});

const stripeAccountId = computed({
    get: () => privateConfig.value.stripeAccountId,
    set: (value: string | null) => {
        patchPrivateConfig(PrivatePaymentConfiguration.patch({
            stripeAccountId: value,
        }));
    },
});

const hasMollieOrBuckaroo = computed(() => {
    return organization.value.privateMeta?.buckarooSettings !== null || !!organization.value.privateMeta?.mollieOnboarding?.canReceivePayments;
});

const hasPayconiq = computed(() => {
    return (organization.value.privateMeta?.payconiqAccounts.length ?? 0) > 0;
});

async function loadStripeAccounts() {
    try {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: '/stripe/accounts',
            decoder: new ArrayDecoder(StripeAccount as Decoder<StripeAccount>),
            shouldRetry: true,
            owner,
        });
        stripeAccounts.value = response.data;

        if (isNew.value || (!hasMollieOrBuckaroo.value && !stripeAccountObject.value)) {
            stripeAccountId.value = stripeAccounts.value[0]?.id ?? null;
        }

        // todo: use watch instead?
        nextTick(() => {
            setDefaultSelection();
        }).catch(console.error);
    }
    catch (e) {
        console.error(e);
    }
}

function getEnableErrorMessage(paymentMethod: PaymentMethod): string | undefined {
    if (paymentMethod === PaymentMethod.Unknown || paymentMethod === PaymentMethod.Transfer || paymentMethod === PaymentMethod.PointOfSale) {
        return;
    }

    if (organization.value?.privateMeta?.getPaymentProviderFor(paymentMethod, stripeAccountObject.value?.meta)) {
        return;
    }

    if (organization.value.privateMeta?.buckarooSettings?.paymentMethods.includes(paymentMethod)) {
        return;
    }

    switch (paymentMethod) {
        case PaymentMethod.Payconiq: {
            if ((organization.value.privateMeta?.payconiqApiKey ?? '').length == 0) {
                return 'Je moet eerst Payconiq activeren via de betaalinstellingen (Instellingen > Betaalaccounts).';
            }
            break;
        }

        case PaymentMethod.iDEAL:
        case PaymentMethod.CreditCard:
        case PaymentMethod.Bancontact: {
            if (stripeAccountObject.value) {
                return PaymentMethodHelper.getName(paymentMethod) + ' is nog niet geactiveerd door Stripe. Kijk na of alle nodige informatie is ingevuld in jullie Stripe dashboard. Vaak is het probleem dat het adres van één van de bestuurders ontbreekt in Stripe of de websitelink van de vereniging niet werd ingevuld.';
            }
            break;
        }
    }

    return 'Je kan ' + PaymentMethodHelper.getName(paymentMethod) + ' niet activeren, daarvoor moet je eerst aansluiten bij een betaalprovider via de Stamhoofd instellingen > Betaalaccounts.';
}

// on created
loadStripeAccounts().catch(console.error);

function getPaymentMethod(method: PaymentMethod) {
    return config.value.paymentMethods.includes(method);
}

function setPaymentMethod(method: PaymentMethod, enabled: boolean, force = false) {
    if (enabled === getPaymentMethod(method)) {
        return;
    }

    const arr = new PatchableArray<PaymentMethod, PaymentMethod, PaymentMethod>();
    if (enabled) {
        const errorMessage = getEnableErrorMessage(method);
        if (!force && errorMessage) {
            new Toast(errorMessage, 'error red').setHide(15 * 1000).show();
            return;
        }
        arr.addPut(method);
    }
    else {
        if (!force && config.value.paymentMethods.length == 1) {
            new Toast('Je moet minimaal één betaalmethode accepteren', 'error red').show();
            return;
        }

        arr.addDelete(method);
    }

    patchConfig(PaymentConfiguration.patch({
        paymentMethods: arr,
    }));
}

function canEnablePaymentMethod(method: PaymentMethod) {
    const errorMessage = getEnableErrorMessage(method);
    return !errorMessage;
}

const sortedPaymentMethods = computed(() => {
    const r: PaymentMethod[] = [];

    const country = I18nController.shared.countryCode;

    // Force a given ordering
    if (country === Country.Netherlands) {
        r.push(PaymentMethod.iDEAL);
    }

    // Force a given ordering
    if (country === Country.Belgium || getPaymentMethod(PaymentMethod.Payconiq)) {
        r.push(PaymentMethod.Payconiq);
    }

    // Force a given ordering
    r.push(PaymentMethod.Bancontact);

    // Force a given ordering
    if (country !== Country.Netherlands) {
        r.push(PaymentMethod.iDEAL);
    }

    r.push(PaymentMethod.CreditCard);

    r.push(PaymentMethod.Transfer);
    r.push(PaymentMethod.PointOfSale);

    // Sort so all disabled are at the end:
    r.sort((a, b) => Sorter.byBooleanValue(canEnablePaymentMethod(a), canEnablePaymentMethod(b)));
    return r;
});

function setDefaultSelection() {
    if (config.value.paymentMethods.length == 0) {
        const ignore = [
            PaymentMethod.Unknown,
            PaymentMethod.Transfer,
            PaymentMethod.PointOfSale,
        ];

        let found = false;

        // Check if online payments are enabled
        for (const p of sortedPaymentMethods.value) {
            if (!ignore.includes(p) && canEnablePaymentMethod(p)) {
                setPaymentMethod(p, true);
                found = true;
            }
        }

        if (!found) {
            // Enable point of sale
            setPaymentMethod(PaymentMethod.PointOfSale, true);
        }
    }
}

defineExpose({
    shouldNavigateAway,
});
</script>

<style lang="scss" scoped>
.illustration-radio-container {

// todo: change in inputs.scss?
        &:has(> :last-child:nth-child(2)) { /* 2 elements */
        grid-template-columns: 1fr 1fr 1fr;
    }
}
</style>
