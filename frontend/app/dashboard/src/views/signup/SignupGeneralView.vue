<template>
    <LoadingViewTransition>
        <form v-if="!loadingRegisterCode" id="signup-general-view" class="st-view" @submit.prevent="goNext">
            <STNavigationBar :title="$t(`%3E`)" />

            <main>
                <h1>
                    {{ $t("%5W") }}
                </h1>
                <p>
                    {{ $t('%WY') }} <a v-if="validatedRegisterCode" :href="'https://'+ $domains.marketing" target="_blank" class="inline-link">{{ $t("%5V") }}</a>
                </p>
                <button v-if="!validatedRegisterCode && visitViaUrl" class="info-box with-button selectable" type="button" @click="dismiss()">
                    {{ $t('%5S') }}
                    <span class="button text" type="button">
                        {{ $t('%WZ') }}
                    </span>
                </button>

                <p v-if="validatedRegisterCode && !validatedRegisterCode.customMessage" class="success-box icon gift">
                    {{ $t('%Wa', {value: formatPrice(validatedRegisterCode.value), organization: validatedRegisterCode.organizationName ?? ''}) }}
                </p>
                <p v-else-if="validatedRegisterCode" class="success-box icon gift">
                    {{ validatedRegisterCode.customMessage }}
                </p>

                <p v-if="reuseRegisterCode" class="warning-box">
                    {{ $t('%4F') }}
                </p>

                <STErrorsDefault :error-box="errors.errorBox" />
                <div class="split-inputs">
                    <div>
                        <STInputBox :title="$t('%8B')" error-fields="name" :error-box="errors.errorBox">
                            <input id="organization-name" ref="firstInput" v-model="name" data-testid="organization-name-input" class="input" type="text" :placeholder="$t('%8C')" autocomplete="organization">
                        </STInputBox>

                        <AddressInput v-model="address" :title="$t('%8a')" :validator="errors.validator" :link-country-to-locale="true" />
                        <p class="style-description-small">
                            {{ $t('%Wb') }}
                        </p>
                    </div>

                    <div>
                        <STInputBox error-fields="type" :error-box="errors.errorBox" :title="$t(`%Wj`)">
                            <Dropdown v-model="type" data-testid="organization-type-select">
                                <option :value="null" disabled>
                                    {{ $t('%1Fq') }}
                                </option>

                                <optgroup v-for="group in availableTypes" :key="group.name" :label="group.name">
                                    <option v-for="_type in group.types" :key="_type.value" :value="_type.value">
                                        {{ _type.name }}
                                    </option>
                                </optgroup>
                            </Dropdown>
                        </STInputBox>
                        <p class="style-description-small">
                            {{ $t('%Wc') }}
                        </p>

                        <STInputBox v-if="type === 'Youth' && isBelgium" error-fields="umbrellaOrganization" :error-box="errors.errorBox" :title="$t(`%Wk`)">
                            <Dropdown v-model="umbrellaOrganization" data-testid="organization-umbrella-select">
                                <option :value="null" disabled>
                                    {{ $t('%1Fq') }}
                                </option>
                                <option v-for="item in availableUmbrellaOrganizations" :key="item.value" :value="item.value">
                                    {{ item.name }}
                                </option>
                            </Dropdown>
                        </STInputBox>
                    </div>
                </div>

                <template v-if="!validatedRegisterCode">
                    <hr><h2>{{ $t('%Wd') }}</h2>

                    <Checkbox :model-value="getBooleanType(AcquisitionType.Recommended)" data-testid="acquisition-recommended-checkbox" @update:model-value="setBooleanType(AcquisitionType.Recommended, $event)">
                        {{ $t('%We') }}
                    </Checkbox>
                    <Checkbox :model-value="getBooleanType(AcquisitionType.Seen)" data-testid="acquisition-seen-checkbox" @update:model-value="setBooleanType(AcquisitionType.Seen, $event)">
                        {{ $t('%Wf') }}
                    </Checkbox>
                    <Checkbox :model-value="getBooleanType(AcquisitionType.SocialMedia)" data-testid="acquisition-social-media-checkbox" @update:model-value="setBooleanType(AcquisitionType.SocialMedia, $event)">
                        {{ $t('%Wg') }}
                    </Checkbox>
                    <Checkbox :model-value="getBooleanType(AcquisitionType.Search)" data-testid="acquisition-search-checkbox" @update:model-value="setBooleanType(AcquisitionType.Search, $event)">
                        {{ $t('%Wh') }}
                    </Checkbox>
                    <Checkbox :model-value="getBooleanType(AcquisitionType.Other)" data-testid="acquisition-other-checkbox" @update:model-value="setBooleanType(AcquisitionType.Other, $event)">
                        {{ $t('%1JG') }}
                    </Checkbox>
                </template>
            </main>

            <STToolbar>
                <template #right>
                    <LoadingButton :loading="loading">
                        <button class="button primary" type="submit" data-testid="signup-next-button" @click.prevent="goNext">
                            {{ $t('%Wi') }}
                        </button>
                    </LoadingButton>
                </template>
            </STToolbar>
        </form>
    </LoadingViewTransition>
</template>

<script lang="ts" setup>
import { Decoder } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, useDismiss, useShow } from '@simonbackx/vue-app-navigation';
import LoadingViewTransition from '@stamhoofd/components/containers/LoadingViewTransition.vue';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import AddressInput from '@stamhoofd/components/inputs/AddressInput.vue';
import Checkbox from '@stamhoofd/components/inputs/Checkbox.vue';
import Dropdown from '@stamhoofd/components/inputs/Dropdown.vue';
import STInputBox from '@stamhoofd/components/inputs/STInputBox.vue';
import LoadingButton from '@stamhoofd/components/navigation/LoadingButton.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import STToolbar from '@stamhoofd/components/navigation/STToolbar.vue';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import { I18nController } from '@stamhoofd/frontend-i18n/I18nController';
import { NetworkManager } from '@stamhoofd/networking/NetworkManager';
import { Storage } from '@stamhoofd/networking/Storage';
import { AcquisitionType, Address, Country, Organization, OrganizationMetaData, OrganizationPrivateMetaData, OrganizationType, OrganizationTypeHelper, RecordConfigurationFactory, RegisterCode, UmbrellaOrganization, UmbrellaOrganizationHelper } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';

import { MetaKey, useErrors, useMetaInfo } from '@stamhoofd/components';
import { computed, onMounted, ref } from 'vue';
import SignupAccountView from './SignupAccountView.vue';

useMetaInfo({
    title: 'Sluit jouw vereniging aan | Stamhoofd',
    options: {
        key: MetaKey.Routing,
    },
    meta: [
        {
            id: 'description',
            name: 'description',
            content: 'Maak een gratis account aan om alles van Stamhoofd uit te proberen. Geheel zonder verplichtingen.',
        },
    ],
});

const props = withDefaults(defineProps<{
    visitViaUrl: boolean;
    initialRegisterCode: { code: string; organization: string } | null;
}>(), {
    visitViaUrl: false,
    initialRegisterCode: null,

});

const name = ref('');
const errors = useErrors();
const show = useShow();
const dismiss = useDismiss();

const address = ref<Address | null>(null);
const acquisitionTypes = ref<AcquisitionType[]>([]);

let registerCode = props.initialRegisterCode;

const validatedRegisterCode = ref<null | RegisterCode>(null);

const reuseRegisterCode = ref(false);

const loading = ref(false);
const loadingRegisterCode = ref(true);

const type = ref<OrganizationType | null>(null);
const umbrellaOrganization = ref<UmbrellaOrganization | null>(null);

onMounted(() => {
    loadRegisterCode().catch(console.error);
});

async function loadRegisterCode() {
    loadingRegisterCode.value = true;

    if (props.initialRegisterCode) {
        try {
            await Storage.keyValue.setItem('savedRegisterCode', JSON.stringify(props.initialRegisterCode));
            await Storage.keyValue.setItem('savedRegisterCodeDate', new Date().getTime() + '');
        }
        catch (e) {
            console.error(e);
        }
    }
    try {
        const currentCount = await Storage.keyValue.getItem('what-is-new');
        const saved = await Storage.keyValue.getItem('savedRegisterCode');
        const dString = await Storage.keyValue.getItem('savedRegisterCodeDate');

        if (saved !== null && dString !== null) {
            const d = parseInt(dString);
            if (!isNaN(d) && d > new Date().getTime() - 24 * 60 * 60 * 1000) {
                const parsed = JSON.parse(saved);
                if (parsed.code && parsed.organization) {
                    if (currentCount === null) {
                        registerCode = JSON.parse(saved);
                    }
                    else {
                        reuseRegisterCode.value = true;
                        registerCode = null;
                    }
                }
            }
            else {
                // Expired or invalid
                await Storage.keyValue.removeItem('savedRegisterCode');
                await Storage.keyValue.removeItem('savedRegisterCodeDate');
                registerCode = null;
            }
        }
        else {
            await Storage.keyValue.removeItem('savedRegisterCode');
            await Storage.keyValue.removeItem('savedRegisterCodeDate');
            registerCode = null;
        }
    }
    catch (e) {
        console.error(e);
    }

    if (registerCode) {
        try {
            await validateCode();
        }
        catch (e) {
            errors.errorBox = new ErrorBox(e);
            registerCode = null;
            await Storage.keyValue.removeItem('savedRegisterCode');
            await Storage.keyValue.removeItem('savedRegisterCodeDate');
        }
    }
    loadingRegisterCode.value = false;
}

const isBelgium = computed(() => I18nController.shared.countryCode === Country.Belgium && (!address.value || address.value.country === Country.Belgium));

async function validateCode() {
    // Check register code
    if (registerCode) {
        try {
            const response = await NetworkManager.server.request({
                method: 'GET',
                path: '/register-code/' + encodeURIComponent(registerCode.code.toUpperCase()),
                decoder: RegisterCode as Decoder<RegisterCode>,
            });
            validatedRegisterCode.value = response.data;
            acquisitionTypes.value = [AcquisitionType.Recommended];
        }
        catch (e) {
            if (isSimpleError(e) || isSimpleErrors(e)) {
                if (e.hasCode('invalid_code')) {
                    throw new SimpleError({
                        code: 'invalid_code',
                        message: 'De gebruikte doorverwijzingslink is niet meer geldig. Je kan verder met registereren, maar je ontvangt geen tegoed.',
                        field: 'registerCode',
                    });
                }
            }
            throw e;
        }
    }
}

async function goNext() {
    if (loading.value) {
        return;
    }

    try {
        if (name.value.length === 0) {
            throw new SimpleError({
                code: 'invalid_field',
                message: '',
                human: 'Vul de naam van jouw vereniging in',
                field: 'name',
            });
        }
        if (name.value.length < 4) {
            throw new SimpleError({
                code: 'invalid_field',
                message: '',
                human: 'De naam van jouw vereniging is te kort',
                field: 'name',
            });
        }

        if (type.value === null) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Maak een keuze',
                field: 'type',
            });
        }

        if (type.value === OrganizationType.Youth && isBelgium.value) {
            if (umbrellaOrganization.value === null) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'Maak een keuze',
                    field: 'umbrellaOrganization',
                });
            }
        }
        else {
            umbrellaOrganization.value = null;
        }

        loading.value = true;
        errors.errorBox = null;

        if (!await errors.validator.validate() || !address.value) {
            loading.value = false;
            return;
        }

        // Check register code
        try {
            await validateCode();
        }
        catch (e) {
            errors.errorBox = new ErrorBox(e);
            loading.value = false;
            return;
        }

        const defaultStartDate = new Date();
        defaultStartDate.setMonth(defaultStartDate.getMonth() + 1);
        defaultStartDate.setDate(1);

        const defaultEndDate = new Date(defaultStartDate.getTime());
        defaultEndDate.setFullYear(defaultStartDate.getFullYear() + 1);

        const organization = Organization.create({
            name: name.value,
            uri: '', // ignored by backend for now
            meta: OrganizationMetaData.create({
                type: type.value,
                umbrellaOrganization: umbrellaOrganization.value,
                recordsConfiguration: RecordConfigurationFactory.create(type.value, address.value.country),
                defaultStartDate,
                defaultEndDate,
            }),
            privateMeta: OrganizationPrivateMetaData.create({
                acquisitionTypes: acquisitionTypes.value,
            }),
            address: address.value,
        });

        loading.value = false;
        errors.errorBox = null;
        show(new ComponentWithProperties(SignupAccountView, { organization, registerCode: registerCode })).catch(console.error);
        plausible('signupGeneral');
    }
    catch (e) {
        loading.value = false;
        console.error(e);
        errors.errorBox = new ErrorBox(e);
        plausible('signupGeneralError');

        if (STAMHOOFD.environment === 'development' && name.value.length === 0) {
            console.log('Autofill for development mode enabled. Filling in default values...');
            // Autofill all
            name.value = 'Testvereniging ' + Math.floor(Math.random() * 100000);
            address.value = Address.create({
                street: 'Teststraat',
                number: '1',
                postalCode: '9000',
                city: 'Gent',
                country: Country.Belgium,
            });
            type.value = OrganizationType.Other;
        }
        return;
    }
}

const availableTypes = computed(() => {
    const types = OrganizationTypeHelper.getList().sort((a, b) =>
        Sorter.stack(
            Sorter.byBooleanValue(
                !a.name.toLowerCase().startsWith('andere'),
                !b.name.toLowerCase().startsWith('andere'),
            ),
            Sorter.byStringProperty(a, b, 'name'),
        ),
    );

    // Group by category
    const map = new Map<string, {
        value: OrganizationType;
        name: string;
    }[]>();

    for (const type of types) {
        const cat = OrganizationTypeHelper.getCategory(type.value);
        if (!map.has(cat)) {
            map.set(cat, [type]);
        }
        else {
            map.get(cat)!.push(type);
        }
    }

    const keys = Array.from(map.keys()).sort(Sorter.byStringValue);

    return keys.map((key) => {
        const types = map.get(key)!;
        return {
            name: key,
            types,
        };
    });
});

const availableUmbrellaOrganizations = computed(() => {
    return UmbrellaOrganizationHelper.getList().sort((a, b) =>
        Sorter.stack(
            Sorter.byBooleanValue(
                !a.name.toLowerCase().startsWith('andere'),
                !b.name.toLowerCase().startsWith('andere'),
            ),
            Sorter.byStringProperty(a, b, 'name'),
        ),
    );
});

async function shouldNavigateAway() {
    if (name.value === '' && address.value === null && type.value === null) {
        return true;
    }
    if (await CenteredMessage.confirm('Ben je zeker dat je dit venster wilt sluiten?', 'Sluiten')) {
        plausible('closeSignup');
        return true;
    }
    plausible('cancelCloseSignup');
    return false;
}

// Helpers ---

function getBooleanType(type: AcquisitionType) {
    return !!acquisitionTypes.value.find(r => r === type);
}

function setBooleanType(type: AcquisitionType, enabled: boolean) {
    const index = acquisitionTypes.value.findIndex(r => r === type);
    if ((index !== -1) === enabled) {
        return;
    }

    if (enabled) {
        acquisitionTypes.value.push(type);
    }
    else {
        acquisitionTypes.value.splice(index, 1);
    }
}

defineExpose({
    shouldNavigateAway,
});
</script>
