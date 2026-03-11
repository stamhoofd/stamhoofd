<template>
    <SaveView :title="viewTitle" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>{{ viewTitle }}</h1>
        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox error-fields="meta.name" :error-box="errors.errorBox" :title="$t(`%Qo`)">
            <input v-model="name" class="input" type="text" autocomplete="off" :placeholder="$t(`%Qp`)"><p v-if="name.length > 30" class="style-description-small">
                {{ $t("%Qm") }}
            </p>
        </STInputBox>

        <hr><h2>{{ $t('%1B') }}</h2>

        <STList>
            <STListItem :selectable="true" element-name="label" class="left-center">
                <template #left>
                    <Radio v-model="ticketType" :value="WebshopTicketType.None" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('%QS') }}
                </h3>
                <p class="style-description">
                    {{ $t('%QT') }}
                </p>
            </STListItem>
            <STListItem :selectable="true" element-name="label" class="left-center">
                <template #left>
                    <Radio v-model="ticketType" :value="WebshopTicketType.SingleTicket" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('%QU') }}
                </h3>
                <p class="style-description">
                    {{ $t('%QV') }}
                </p>
            </STListItem>
            <STListItem :selectable="true" element-name="label" class="left-center">
                <template #left>
                    <Radio v-model="ticketType" :value="WebshopTicketType.Tickets" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('%QW') }}
                </h3>
                <p class="style-description">
                    {{ $t('%QX') }}
                </p>
            </STListItem>
        </STList>

        <p v-if="ticketType === WebshopTicketType.SingleTicket" class="info-box">
            {{ $t("%Qn") }}
        </p>
        <p v-if="ticketType === WebshopTicketType.Tickets" class="info-box">
            {{ $t('%QY') }}
        </p>

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

        <template v-if="isNew">
            <hr><h2>{{ $t('%O7') }}</h2>
            <p>{{ $t('%Qf') }} <a class="inline-link" :href="$domains.getDocs('betaalmethodes-voor-webshops-instellen')" target="_blank">{{ $t('%OH') }}</a>.</p>

            <EditPaymentMethodsBox type="webshop" :organization="organization" :config="config" :private-config="privateConfig" :validator="errors.validator" :show-administration-fee="false" @patch:config="patchConfig($event)" @patch:private-config="patchPrivateConfig($event)" />
        </template>

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
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { Checkbox, DateSelection, NumberInput, Radio, SaveView, STErrorsDefault, STInputBox, STList, STListItem, TimeInput, Toast, useContext } from '@stamhoofd/components';
import { PaymentConfiguration, PrivatePaymentConfiguration, PrivateWebshop, Product, ProductType, WebshopAuthType, WebshopMetaData, WebshopNumberingType, WebshopPrivateMetaData, WebshopStatus, WebshopTicketType } from '@stamhoofd/structures';

import { computed } from 'vue';
import EditPaymentMethodsBox from '../../../../components/EditPaymentMethodsBox.vue';
import { useEditWebshop, UseEditWebshopProps } from './useEditWebshop';

const props = defineProps<UseEditWebshopProps>();

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
const organization = computed(() => context.value.organization);

const viewTitle = computed(() => {
    if (isNew.value) {
        return 'Nieuwe verkoop, inschrijvingsformulier of geldinzameling starten';
    }
    return 'Algemene instellingen';
});

const name = computed({
    get: () => webshop.value.meta.name,
    set: (name: string) => addPatch(PrivateWebshop.patch({ meta: WebshopMetaData.patch({ name }) })),
});

// const roles = computed(() => organization.value?.privateMeta?.roles ?? []);

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

function patchPrivateConfig(patch: PrivatePaymentConfiguration) {
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

defineExpose({
    shouldNavigateAway,
});
</script>
