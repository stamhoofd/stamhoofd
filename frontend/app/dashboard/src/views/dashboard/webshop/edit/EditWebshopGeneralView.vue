<template>
    <SaveView :title="viewTitle" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>{{ viewTitle }}</h1>
        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox title="Naam (kort)" error-fields="meta.name" :error-box="errors.errorBox">
            <input
                v-model="name"
                class="input"
                type="text"
                placeholder="bv. Wafelverkoop"
                autocomplete="off"
            >

            <p v-if="name.length > 30" class="style-description-small">
                Lange naam? Je kan de zichtbare titel op de webshop apart wijzigen bij de instellingen 'Personaliseren'. Hier houd je het beter kort.
            </p>
        </STInputBox>

        <hr>
        <h2>Type</h2>

        <STList>
            <STListItem :selectable="true" element-name="label" class="left-center">
                <template #left>
                    <Radio v-model="ticketType" :value="WebshopTicketType.None" />
                </template>
                <h3 class="style-title-list">
                    Geen tickets
                </h3>
                <p class="style-description">
                    Webshop zonder scanners. Er worden geen tickets aangemaakt.
                </p>
            </STListItem>
            <STListItem :selectable="true" element-name="label" class="left-center">
                <template #left>
                    <Radio v-model="ticketType" :value="WebshopTicketType.SingleTicket" />
                </template>
                <h3 class="style-title-list">
                    Ticketverkoop voor groepen
                </h3>
                <p class="style-description">
                    Eén ticket per bestelling. Ideaal voor een eetfestijn
                </p>
            </STListItem>
            <STListItem :selectable="true" element-name="label" class="left-center">
                <template #left>
                    <Radio v-model="ticketType" :value="WebshopTicketType.Tickets" />
                </template>
                <h3 class="style-title-list">
                    Ticketverkoop voor personen
                </h3>
                <p class="style-description">
                    Eén ticket per artikel. Ideaal voor een fuif
                </p>
            </STListItem>
        </STList>

        <p v-if="ticketType === WebshopTicketType.SingleTicket" class="info-box">
            Per bestelling wordt er maar één ticket met QR-code aangemaakt. Dus als er 5 spaghetti's en één beenham besteld worden, dan krijgt de besteller één scanbaar ticket.
        </p>
        <p v-if="ticketType === WebshopTicketType.Tickets" class="info-box">
            Op de webshop staan tickets en vouchers te koop die elk hun eigen QR-code krijgen en apart gescand moeten worden. Ideaal voor een fuif of evenement waar toegang betalend is per persoon. Minder ideaal voor grote groepen omdat je dan elk ticket afzonderlijk moet scannen (dus best niet voor een eetfestijn gebruiken).
        </p>

        <hr>
        <h2>Beschikbaarheid</h2>

        <Checkbox v-model="hasStatusClosed">
            {{ $t('4ae26268-586e-41f7-875d-90137f9ed836') }}
        </Checkbox>

        <template v-if="!hasStatusClosed">
            <Checkbox v-model="useAvailableUntil">
                Sluit webshop na een bepaalde datum
            </Checkbox>
            <div v-if="useAvailableUntil" class="split-inputs">
                <STInputBox title="Stop bestellingen op" error-fields="settings.availableUntil" :error-box="errors.errorBox">
                    <DateSelection v-model="availableUntil" />
                </STInputBox>
                <TimeInput v-model="availableUntil" title="Om" :validator="errors.validator" />
            </div>
            <Checkbox v-model="useOpenAt">
                Open webshop pas na een bepaalde datum
            </Checkbox>
            <div v-if="useOpenAt" class="split-inputs">
                <STInputBox title="Open op" error-fields="settings.openAt" :error-box="errors.errorBox">
                    <DateSelection v-model="openAt" />
                </STInputBox>
                <TimeInput v-model="openAt" title="Om" :validator="errors.validator" />
            </div>
        </template>

        <div class="container">
            <hr>
            <h2>Nummering</h2>

            <STList>
                <STListItem :selectable="true" element-name="label" class="left-center">
                    <template #left>
                        <Radio v-model="numberingType" :value="WebshopNumberingType.Continuous" />
                    </template>
                    <h3 class="style-title-list">
                        Gebruik opeenvolgende bestelnummers
                    </h3>
                    <p class="style-description">
                        1, 2, 3, ...
                    </p>
                </STListItem>
                <STListItem :selectable="true" element-name="label" class="left-center">
                    <template #left>
                        <Radio v-model="numberingType" :value="WebshopNumberingType.Random" />
                    </template>
                    <h3 class="style-title-list">
                        Gebruik willekeurige bestelnummers
                    </h3>
                    <p class="style-description">
                        964824335, 116455337, 228149715, ...
                    </p>
                </STListItem>
            </STList>

            <STInputBox v-if="numberingType === WebshopNumberingType.Continuous" title="Eerste bestelnummer" error-fields="settings.openAt" :error-box="errors.errorBox">
                <NumberInput v-model="startNumber" :min="1" />
            </STInputBox>
            <p v-if="!isNew && numberingType === WebshopNumberingType.Continuous" class="style-description-small">
                Je kan dit enkel wijzigen als je alle bestellingen verwijdert.
            </p>
        </div>

        <template v-if="isNew">
            <hr>
            <h2>Betaalmethodes</h2>
            <p>Zoek je informatie over alle betaalmethodes, neem dan een kijkje op <a class="inline-link" :href="$domains.getDocs('betaalmethodes-voor-webshops-instellen')" target="_blank">deze pagina</a>.</p>

            <EditPaymentMethodsBox
                type="webshop"
                :organization="organization"
                :config="config"
                :private-config="privateConfig"
                :validator="errors.validator"
                :show-administration-fee="false"
                @patch:config="patchConfig($event)"
                @patch:private-config="patchPrivateConfig($event)"
            />
        </template>

        <div v-if="getFeatureFlag('webshop-auth')" class="container">
            <hr>
            <h2>Inloggen</h2>
            <p>
                Verplicht gebruikers om in te loggen om de webshop te kunnen bekijken.
            </p>

            <STList>
                <STListItem :selectable="true" element-name="label" class="left-center">
                    <template #left>
                        <Radio v-model="authType" :value="WebshopAuthType.Disabled" />
                    </template>
                    <h3 class="style-title-list">
                        Uitgeschakeld
                    </h3>
                    <p class="style-description">
                        Gebruikers kunnen en moeten niet inloggen om een bestelling te plaatsen.
                    </p>
                </STListItem>
                <STListItem :selectable="true" element-name="label" class="left-center">
                    <template #left>
                        <Radio v-model="authType" :value="WebshopAuthType.Required" />
                    </template>
                    <h3 class="style-title-list">
                        Verplicht
                    </h3>
                    <p class="style-description">
                        Gebruikers moeten inloggen om de webshop te zien en een bestelling te plaatsen.
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
