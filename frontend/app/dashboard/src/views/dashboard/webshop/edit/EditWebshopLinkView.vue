<template>
    <SaveView :title="viewTitle" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>{{ viewTitle }}</h1>
        <p>
            Lees zeker ook onze <a :href="$domains.getDocs('webshop-link-wijzigen')" target="_blank" class="inline-link">documentatie hierover</a> na.
        </p>

        <p v-if="legacyUrl && webshop.domain === null" class="info-box">
            We hebben het formaat gewijzigd van webshop links. Maar jouw webshop is (en blijft) ook bereikbaar via {{ legacyUrl }}. In toekomstige communicaties gebruik je best de nieuwe link, maar pas de nieuwe link eerst aan naar wens.
        </p>

        <p v-if="hasOrders" class="warning-box">
            {{ $t('7a44f6f1-bb2f-4e46-93c2-afcae9db3f80') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox title="Domeinnaam">
            <Dropdown v-model="selectedDomain" @update:model-value="onChangeSelectedDomain">
                <option :value="null">
                    {{ defaultDomain }}
                </option>
                <option v-for="d of defaultDomains" :key="d" :value="d">
                    {{ d }}
                </option>
                <option :value="''">
                    Andere domeinnaam
                </option>
            </Dropdown>
        </STInputBox>

        <template v-if="useNewDomain">
            <STInputBox title="Jouw webshop link" error-fields="customUrl" :error-box="errors.errorBox" class="max">
                <input
                    v-model="customUrl"
                    class="input"
                    type="text"
                    :placeholder="$t('e06f1e9b-dc4c-4b3b-8ab7-52cd8048d894')"
                    autocomplete=""
                    @blur="resetCache"
                >
            </STInputBox>
            <p class="st-list-description">
                {{ $t('2ad81e83-bca1-43c9-9f18-3af1ae6e35a7') }}
            </p>

            <template v-if="didDNSRecordsChange">
                <p class="info-box">
                    Jouw webmaster zal enkele wijzigingen moeten doen om deze link mogelijk te maken. We geven je de instructies in de volgende stap.
                </p>
            </template>
            <template v-else>
                <p v-if="webshop.meta.domainActive && originalWebshop.domain === webshop.domain" class="success-box">
                    Jouw domeinnaam is correct geconfigureerd.
                </p>
                <p v-else class="warning-box with-button selectable" @click="openDnsRecordSettings(false)">
                    Jouw domeinnaam is momenteel nog niet actief. Breng de nodige DNS-wijzigingen in orde, dit kan tot 24 uur duren.

                    <button class="button text" type="button">
                        Instellen
                    </button>
                </p>
                <p v-if="webshop.meta.domainActive && originalWebshop.domain === webshop.domain">
                    <button type="button" class="button text" @click="openDnsRecordSettings(false)">
                        Bekijk DNS-records instructies
                    </button>
                </p>
            </template>

            <p v-if="!webshop.meta.domainActive" class="info-box">
                Jouw webshop blijft ook bereikbaar via {{ defaultUrl }}. Die link kan je gebruiken om je webshop te bezoeken in tussentijd, tot de DNS-records zijn aangepast (kan tot 24 uur duren).
            </p>
        </template>

        <template v-else-if="selectedDomain !== null">
            <STInputBox title="Jouw webshop link" error-fields="domainUri" :error-box="errors.errorBox" class="max">
                <template #right>
                    <button type="button" class="button text" @click="copyLink">
                        <span class="icon copy" />
                        <span>Kopiëren</span>
                    </button>
                </template>
                <PrefixInput v-model="domainUri" placeholder="bv. wafelbak" :prefix="domainUri ? webshop.domain+'/' : webshop.domain" :focus-prefix="webshop.domain+'/'" :fade-prefix="!!domainUri" @blur="resetCache" />
            </STInputBox>
            <p class="style-description-small">
                Vul eventueel iets in na het streepje (/), maar dat is niet verplicht.
            </p>
        </template>

        <template v-else>
            <STInputBox title="Jouw webshop link" error-fields="uri" :error-box="errors.errorBox" class="max custom-bottom-box" :class="{'input-success': isAvailable && !checkingAvailability && availabilityCheckerCount > 0, 'input-errors': !isAvailable && !checkingAvailability && availabilityCheckerCount > 0}">
                <template #right>
                    <button type="button" class="button text" @click="copyLink">
                        <span class="icon copy" />
                        <span>Kopiëren</span>
                    </button>
                </template>
                <PrefixInput v-model="uri" placeholder="bv. wafelbak" :prefix="defaultDomain+'/'" @blur="updateUri" />
            </STInputBox>

            <template v-if="errors.errorBox === null && ((availabilityCheckerCount > 0 && isAvailable !== null) || checkingAvailability)">
                <p v-if="checkingAvailability" class="loading-box">
                    <Spinner />
                    Nakijken of deze link nog beschikbaar is...
                </p>

                <p v-else-if="uri.length === 0" class="error-box">
                    Je moet verplicht iets na de domeinnaam invullen.
                </p>

                <p v-else-if="!isAvailable" class="error-box">
                    Deze link is al in gebruik. Kies een andere. Voeg iets uniek toe, bv. de naam van je vereniging.
                </p>

                <p v-else class="success-box">
                    Deze link is nog beschikbaar!
                </p>
            </template>
        </template>
    </SaveView>
</template>

<script lang="ts" setup>
import { Decoder } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { Request } from '@simonbackx/simple-networking';
import { ComponentWithProperties, usePresent, useShow } from '@simonbackx/vue-app-navigation';
import { Dropdown, PrefixInput, SaveView, Spinner, STErrorsDefault, STInputBox, Toast, Tooltip, useContext, useOrganization } from '@stamhoofd/components';
import { DNSRecordStatus, PrivateWebshop, WebshopUriAvailabilityResponse } from '@stamhoofd/structures';
import { Formatter, throttle } from '@stamhoofd/utility';

import { useRequestOwner } from '@stamhoofd/networking';
import { computed, onMounted, ref } from 'vue';
import { useEditWebshop, UseEditWebshopProps } from './useEditWebshop';
import WebshopDNSRecordsView from './WebshopDNSRecordsView.vue';

const props = defineProps<UseEditWebshopProps>();

const { webshop, addPatch, errors, saving, save, hasChanges, originalWebshop } = useEditWebshop({
    validate,
    shouldDismiss,
    getProps: () => props,
});
const requestOwner = useRequestOwner();
const context = useContext();

const viewTitle = 'Webshop link wijzigen';

const present = usePresent();
const show = useShow();
const organization = useOrganization();
const cachedCustomUrl = ref<string | null>(null);

const checkingAvailability = ref(false);
const availabilityCheckerCount = ref(0);
const isAvailable = ref<boolean | null>(null);
const checkedUri = ref('');

const selectedDomain = ref<string | null>(null);
const hasOrders = ref(false);

function created() {
    hasOrders.value = !!props.webshopManager?.lastFetchedOrder;

    if (!hasOrders.value && props.webshopManager) {
        props.webshopManager.streamOrders({ callback: () => {
            hasOrders.value = true;
        }, limit: 1 }).catch(console.error);
    }
}

created();

onMounted(() => {
    selectedDomain.value = webshop.value.meta.domainActive ? webshop.value.domain : (webshop.value.domain ? '' : null);
});

const defaultDomains = computed<string[]>(() => Formatter.uniqueArray((organization.value!.webshops).filter(w => w.meta.domainActive && w.domain).map(w => w.domain) as string[]));

function onChangeSelectedDomain() {
    cachedCustomUrl.value = null;
    if (selectedDomain.value !== null && selectedDomain.value !== '') {
        const patch = PrivateWebshop.patch({ domain: selectedDomain.value });
        addPatch(patch);
    }
    if (selectedDomain.value === null) {
        const patch = PrivateWebshop.patch({ domain: null });
        addPatch(patch);
    }
}

const doThrottledCheckUriAvailability = throttle(checkUriAvailability, 1000);

function quickValidate() {
    if (Formatter.slug(uri.value).length === 0) {
        isAvailable.value = false;
        checkedUri.value = '';

        // Invalidate all currently working checks
        availabilityCheckerCount.value++;

        // Mark loading as done
        checkingAvailability.value = false;
        return true;
    }

    if (Formatter.slug(uri.value) === originalWebshop.uri) {
        isAvailable.value = true;
        checkedUri.value = originalWebshop.uri;

        // Invalidate all currently working checks
        if (availabilityCheckerCount.value === 0) {
            // keep at zero, no need to say again that it is valid
        }
        else {
            availabilityCheckerCount.value++;
        }

        // Mark loading as done
        checkingAvailability.value = false;
        return true;
    }

    if (Formatter.slug(uri.value) === checkedUri.value || Formatter.slug(uri.value) === originalWebshop.uri) {
        // keep same state
        // Invalidate all currently working checks
        availabilityCheckerCount.value++;

        // Mark loading as done
        checkingAvailability.value = false;
        return true;
    }
    return false;
}

function throttledCheckUriAvailability() {
    errors.errorBox = null;
    Request.cancelAll(requestOwner);
    if (quickValidate()) {
        return;
    }
    availabilityCheckerCount.value++;
    checkingAvailability.value = true;
    isAvailable.value = null;
    doThrottledCheckUriAvailability();
}

const legacyUrl = computed(() => webshop.value.getLegacyUrl(organization.value!));

const defaultUrl = computed(() => webshop.value.getDefaultUrl(organization.value!));

const domainUri = computed({
    get: () => webshop.value.domainUri,
    set: (domainUri: string | null) => {
        resetCache();
        const patch = PrivateWebshop.patch({ domainUri: domainUri ? Formatter.slug(domainUri) : '' });
        addPatch(patch);
    },
});

const uri = computed({
    get: () => webshop.value.uri,
    set: (uri: string) => {
        const patch = PrivateWebshop.patch({ });
        patch.uri = uri;

        addPatch(patch);

        throttledCheckUriAvailability();
    },
});

function updateUri() {
    const cleaned = Formatter.slug(uri.value);
    if (cleaned !== uri.value) {
        uri.value = cleaned;
        new Toast('Een link mag geen spaties, speciale tekens of hoofdletters bevatten', 'info').show();
    }
    throttledCheckUriAvailability();
}

function resetCache() {
    cachedCustomUrl.value = null;
}

async function checkUriAvailability() {
    if (quickValidate()) {
        return;
    }

    availabilityCheckerCount.value++;
    const c = availabilityCheckerCount.value;
    const formattedUri = Formatter.slug(uri.value);
    checkingAvailability.value = true;
    isAvailable.value = false;

    Request.cancelAll(requestOwner);

    try {
        errors.errorBox = null;
        const response = await context.value.authenticatedServer.request({
            path: '/webshop/' + webshop.value.id + '/check-uri',
            method: 'GET',
            query: {
                uri,
            },
            decoder: WebshopUriAvailabilityResponse as Decoder<WebshopUriAvailabilityResponse>,
            owner: requestOwner,
            shouldRetry: false,
        });

        if (availabilityCheckerCount.value !== c || formattedUri !== Formatter.slug(uri.value)) {
            console.info('Ignored response, counter or uri has already changed');
            // Ignore, because a new request has already started
            return;
        }

        checkedUri.value = formattedUri;

        checkingAvailability.value = false;
        if (response.data.available) {
            isAvailable.value = true;
        }
        else {
            isAvailable.value = false;
        }
    }
    catch (e) {
        Toast.fromError(e).show();
        checkingAvailability.value = false;
        isAvailable.value = null;
        throw e;
    }
}

const useNewDomain = computed(() => {
    if (selectedDomain.value === '') {
        return true;
    }
    return false;
});

const defaultDomain = computed(() => webshop.value.getDefaultDomain(organization.value!));
const url = computed(() => 'https://' + webshop.value.getUrl(organization.value!));
const customUrl = computed({ get: () => {
    if (cachedCustomUrl.value) {
        return cachedCustomUrl.value;
    }

    if (!webshop.value.domain) {
        return '';
    }
    return webshop.value.getDomainUrl();
},
set: (customUrl: string) => {
    cachedCustomUrl.value = customUrl;
    const split = customUrl.split('/');

    const patch = PrivateWebshop.patch({ });
    if (split[0].length === 0) {
        patch.domain = null;
        patch.domainUri = '';
    }
    else {
        patch.domain = split[0].toLowerCase().replace(/[^a-zA-Z0-9-.]/g, '');

        if (!split[1] || split[1].length === 0) {
            patch.domainUri = '';
        }
        else {
            patch.domainUri = Formatter.slug(split[1]);
        }
    }

    addPatch(patch);
},
});

function openDnsRecordSettings(replace = false) {
    const component = new ComponentWithProperties(WebshopDNSRecordsView, {
        webshopManager: props.webshopManager,
    });

    if (replace) {
        show({
            components: [component],
            animated: true,
        }).catch(console.error);
    }
    else {
        present({
            components: [component],
            modalDisplayStyle: 'popup',
        }).catch(console.error);
    }
}

function shouldDismiss(): Promise<boolean> | boolean {
    if (webshop.value.privateMeta.dnsRecords.find(r => r.status !== DNSRecordStatus.Valid)) {
        openDnsRecordSettings(true);
        return false;
    }
    return true;
}

const didDNSRecordsChange = computed(() => {
    const currently = webshop.value.privateMeta.dnsRecords;

    if (currently.length !== dnsRecords.value.length) {
        return true;
    }

    for (let i = 0; i < currently.length; i++) {
        if (currently[i].type !== dnsRecords.value[i].type || currently[i].value !== dnsRecords.value[i].value || currently[i].name !== dnsRecords.value[i].name) {
            return true;
        }
    }
    return false;
});

const dnsRecords = computed(() => {
    if (!webshop.value.domain) {
        return [];
    }
    try {
        return webshop.value.buildDNSRecords();
    } catch (e) {
        Toast.fromError(e).show()
    }
    return []
});

async function copyLink(event: MouseEvent) {
    if (navigator.clipboard) {
        await navigator.clipboard.writeText(url.value);
    }
    else {
        const input = document.createElement('input');
        input.value = url.value;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
    }

    const displayedComponent = new ComponentWithProperties(Tooltip, {
        text: 'Link gekopieerd!',
        x: event.clientX,
        y: event.clientY + 10,
    });
    present(displayedComponent.setDisplayStyle('overlay')).catch(console.error);

    setTimeout(() => {
        (displayedComponent.componentInstance() as any)?.hide?.();
    }, 1000);
}

async function validate() {
    if (!webshop.value.domain) {
        await checkUriAvailability();
        if (!isAvailable.value) {
            throw new SimpleError({
                code: '',
                field: 'uri',
                message: 'Kies een andere link, deze is ongeldig of al in gebruik.',
            });
        }

        addPatch(PrivateWebshop.patch({ domainUri: null, domain: null }));
    }
    else {
        // Don't change the uri, because error handling could get weird if it is duplicate (the user won't notice it is changed)
        addPatch(PrivateWebshop.patch({ uri: originalWebshop.uri }));

        if (webshop.value.domainUri === null) {
            addPatch(PrivateWebshop.patch({ domainUri: '' }));
        }

        /// Check if URL format is okay
        try {
            const url = new URL('https://' + webshop.value.getDomainUrl());

            const hostname = url.hostname;
            const parts = hostname.split('.');

            if (parts.length === 2) {
                throw new SimpleError({
                    code: '',
                    field: 'customUrl',
                    message: 'Het is niet mogelijk om een hoofddomein te gebruiken voor een webshop. Lees de documentatie hierover na voor meer informatie.',
                });
            }
            const subdomain = parts[0];

            if (subdomain === 'inschrijven') {
                throw new SimpleError({
                    code: '',
                    field: 'customUrl',
                    message: "Het is momenteel niet mogelijk om 'inschrijven' te gebruiken als een subdomeinnaam voor jouw webshop. Deze is gereserveerd voor de ledenadministratie.",
                });
            }
        }
        catch (e) {
            if (isSimpleError(e) || isSimpleErrors(e)) {
                throw e;
            }
            throw new SimpleError({
                code: '',
                field: 'customUrl',
                message: 'Deze domeinnaam is ongeldig.',
            });
        }
    }
}
</script>
