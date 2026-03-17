<template>
    <LoadingViewTransition>
        <form v-if="!loadingRegisterCode" id="signup-general-view" ref="formEl" class="st-view" :class="{complete: isComplete}" @submit.prevent="goNext">
            <STNavigationBar title="Registreren">
                <template #left>
                    <BackButton @click="onPop" />
                </template>

                <template #right>
                    <button v-if="isComplete" type="button" class="button text selected" @click.prevent="goNext">
                        Volgende
                    </button>
                </template>
            </STNavigationBar>

            <main class="center small">
                <aside class="style-title-prefix">
                    {{ $t('STAP {current} / {total}', {current: 1, total: 2}) }}
                </aside>
                <h1>
                    {{ $t("%5W") }}
                </h1>
                <p>
                    {{ $t('%WY') }} <a v-if="validatedRegisterCode" :href="'https://'+ $domains.marketing" target="_blank" class="inline-link">{{ $t("%5V") }}</a>
                </p>

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

                <STInputBox :title="$t(`Wat voor vereniging?`)" error-fields="type" :error-box="errors.errorBox" class="max">
                    <div class="illustration-radio-container">
                        <label v-for="{value, title, imgSrc} in typeOptions" :key="value" class="illustration-radio-box" data-testid="organization-type-option">
                            <div>
                                <Radio v-model="type" :value="value" />
                            </div>
                            <figure>
                                <img :src="imgSrc">
                            </figure>
                            <h3>{{ title }}</h3>
                        </label>
                    </div>
                </STInputBox>

                <STInputBox :title="$t('%8B')" error-fields="name" :error-box="errors.errorBox">
                    <input
                        id="organization-name"
                        ref="firstInput"
                        v-model="name"
                        data-testid="organization-name-input"
                        class="input"
                        type="text"
                        :placeholder="$t('%8C')"
                        autocomplete="off"
                        enterkeyhint="next"
                    >
                </STInputBox>

                <AddressInput v-model="address" enterkeyhint="done" :city-only="true" class="max" :title="$t('%8a')" :validator="errors.validator" :link-country-to-locale="true" />
                <p class="style-description-small">
                    {{ $t('%Wb') }}
                </p>

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

            <STToolbar class="center">
                <template #right>
                    <LoadingButton :loading="loading" class="max">
                        <button class="button primary" type="submit" data-testid="signup-next-button" @click.prevent="goNext">
                            <span>{{ $t("%19q") }}</span>
                            <span class="icon arrow-right" />
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
import { Request } from '@simonbackx/simple-networking';
import { ComponentWithProperties, useCanDismiss, useCanPop, useDismiss, usePop, useShow } from '@simonbackx/vue-app-navigation';
import bikeIllustration from '@stamhoofd/assets/images/illustrations/bike.svg';
import charityIllustration from '@stamhoofd/assets/images/illustrations/charity.svg';
import educationIllustration from '@stamhoofd/assets/images/illustrations/education.svg';
import stageIllustration from '@stamhoofd/assets/images/illustrations/stage.svg';
import teamIllustration from '@stamhoofd/assets/images/illustrations/team.svg';
import tentIllustration from '@stamhoofd/assets/images/illustrations/tent.svg';
import { MetaKey, useErrors, useMetaInfo } from '@stamhoofd/components';
import LoadingViewTransition from '@stamhoofd/components/containers/LoadingViewTransition.vue';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import AddressInput from '@stamhoofd/components/inputs/AddressInput.vue';
import Checkbox from '@stamhoofd/components/inputs/Checkbox.vue';
import STInputBox from '@stamhoofd/components/inputs/STInputBox.vue';
import LoadingButton from '@stamhoofd/components/navigation/LoadingButton.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import STToolbar from '@stamhoofd/components/navigation/STToolbar.vue';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import { LocalizedDomains } from '@stamhoofd/frontend-i18n';
import { useRequestOwner } from '@stamhoofd/networking';
import { NetworkManager } from '@stamhoofd/networking/NetworkManager';
import { Storage } from '@stamhoofd/networking/Storage';
import { AcquisitionType, Address, Country, Organization, OrganizationMetaData, OrganizationPrivateMetaData, OrganizationType, RecordConfigurationFactory, RegisterCode } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue';
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

const formEl = useTemplateRef<HTMLElement>('formEl');
const name = ref('');
const errors = useErrors();
const show = useShow();
const dismiss = useDismiss();
const canPop = useCanPop();
const canDismiss = useCanDismiss();
const pop = usePop();
const owner = useRequestOwner();

const address = ref<Address | null>(null);
const acquisitionTypes = ref<AcquisitionType[]>([]);

let registerCode = props.initialRegisterCode;

const validatedRegisterCode = ref<null | RegisterCode>(null);

const reuseRegisterCode = ref(false);

const loading = ref(false);
const loadingRegisterCode = ref(true);

const type = ref<OrganizationType | null>(null);

let checkCount = 0;

async function checkName() {
    if (name.value.length === 0) {
        return false;
    }

    const uri = Formatter.slug(name.value);

    if (uri.length > 100) {
        throw new SimpleError({
            code: 'invalid_field',
            message: '',
            human: 'De naam van jouw vereniging is te lang. Probeer de naam wat te verkorten en probeer opnieuw.',
            field: 'name',
        });
    }

    checkCount++;
    const c = checkCount;
    const nameCopy = name.value;

    try {
        Request.cancelAll(owner);

        const registrationDomains = STAMHOOFD.domains.registration;
        if (!registrationDomains) {
            throw new Error('No registration domains in env');
        }

        await NetworkManager.server.request({
            method: 'GET',
            path: '/organization-from-domain',
            query: {
                domain: uri + '.' + registrationDomains[''],
            },
            owner,
            shouldRetry: true,
        });
        if (checkCount !== c || name.value !== nameCopy) {
            // Discard
            return;
        }
        return true;
    }
    catch (e) {
        if (checkCount !== c || name.value !== nameCopy) {
            // Discard
            return;
        }
        if (isSimpleError(e) || isSimpleErrors(e)) {
            if (e.hasCode('unknown_organization')) {
                return false;
            }
        }
        throw e;
    }
}

onMounted(() => {
    loadRegisterCode().catch(console.error);
});

watch(formEl, (el) => {
    if (el) {
        el.querySelectorAll('input, textarea, select').forEach((el) => {
            el.addEventListener('focus', () => {
                setTimeout(() => {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'start' });
                }, 300); // wait for keyboard animation
            });
        });
    }
});

const isComplete = computed(() => name.value.length > 2 && address.value !== null && type.value !== null && address.value.city.length >= 3);

function onPop() {
    if (canPop.value) {
        pop()?.catch(console.error);
    }
    if (canDismiss.value) {
        dismiss().catch(console.error);
    }
    // Go back using the history API
    else if (window.history.length > 1) {
        window.history.back();
    }
    else {
        // Go to marketing site
        window.location.href = 'https://' + LocalizedDomains.marketing;
    }
}

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

        loading.value = true;
        errors.errorBox = null;

        const check = await checkName();
        if (check === true || check === undefined) {
            throw new SimpleError({
                code: 'invalid_field',
                message: '',
                human: 'Er bestaat al een vereniging met deze naam. Probeer de naam wat te wijzigen (mogelijks bestaan er meerdere verenigingen met dezelfde naam) of kijk na of jouw vereniging niet al is geregistreerd.',
                field: 'name',
            });
        }

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

const typeOptions: { value: OrganizationType; title: string; imgSrc: string }[] = [
    {
        value: OrganizationType.Sport,
        title: $t('Sport'),
        imgSrc: bikeIllustration,
    },
    {
        value: OrganizationType.Culture,
        title: $t(`%mR`),
        imgSrc: stageIllustration,
    }, {
        value: OrganizationType.Youth,
        title: $t('Jeugd'),
        imgSrc: tentIllustration,
    },
    {
        value: OrganizationType.School,
        title: $t(`%p`),
        imgSrc: educationIllustration,
    },
    {
        value: OrganizationType.GoodCause,
        title: $t('Goed doel'),
        imgSrc: charityIllustration,
    },
    {
        value: OrganizationType.Other,
        title: $t(`%1JG`),
        imgSrc: teamIllustration,
    },

];

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
