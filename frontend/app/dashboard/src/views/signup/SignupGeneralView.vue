<template>
    <LoadingViewTransition>
        <form v-if="!loadingRegisterCode" id="signup-general-view" class="st-view" @submit.prevent="goNext">
            <STNavigationBar :title="$t(`cbdd5da3-8752-423d-8adf-00195fac3864`)" />

            <main>
                <h1>
                    {{ $t("92f76d54-282e-448e-ae15-21411b7bc085") }}
                </h1>
                <p>
                    {{ $t('6bce22dc-e4ac-47f5-aa66-873d02ba9f5f') }} <a v-if="validatedRegisterCode" :href="'https://'+ $domains.marketing" target="_blank" class="inline-link">{{ $t("2ca73761-bc6c-4ffb-9550-a988376f26ef") }}</a>
                </p>
                <button v-if="!validatedRegisterCode && visitViaUrl" class="info-box with-button selectable" type="button" @click="dismiss()">
                    {{ $t('d80e2291-5bb9-4799-9594-bcda54480efa') }}
                    <span class="button text" type="button">
                        {{ $t('4248538e-48b6-4596-a3f6-0fedb910cb8f') }}
                    </span>
                </button>

                <p v-if="validatedRegisterCode && !validatedRegisterCode.customMessage" class="success-box icon gift">
                    {{ $t('09909d45-d69c-4d17-9eff-44dc551032b8', {value: formatPrice(validatedRegisterCode.value), organization: validatedRegisterCode.organizationName ?? ''}) }}
                </p>
                <p v-else-if="validatedRegisterCode" class="success-box icon gift">
                    {{ validatedRegisterCode.customMessage }}
                </p>

                <p v-if="reuseRegisterCode" class="warning-box">
                    {{ $t('5e60cf0f-5489-4e90-8dab-97c56c2e989c') }}
                </p>

                <STErrorsDefault :error-box="errorBox" />
                <div class="split-inputs">
                    <div>
                        <STInputBox :title="$t('d185d3ca-e20f-43a2-a79f-f77404b8f33a')" error-fields="name" :error-box="errorBox">
                            <input id="organization-name" ref="firstInput" v-model="name" data-testid="organization-name-input" class="input" type="text" :placeholder="$t('cb51b737-c4cf-4ea7-aeb5-b5736a43c333')" autocomplete="organization">
                        </STInputBox>

                        <AddressInput v-model="address" :title="$t('68c40b9e-30d7-4ce5-8069-f7ca93221906')" :validator="validator" :link-country-to-locale="true" />
                        <p class="style-description-small">
                            {{ $t('0502b517-9f29-4b4a-ba02-f11a430edeb5') }}
                        </p>
                    </div>

                    <div>
                        <STInputBox error-fields="type" :error-box="errorBox" :title="$t(`b26772a9-019a-4555-a6ca-7eb5200cab8f`)">
                            <Dropdown v-model="type" data-testid="organization-type-select">
                                <option :value="null" disabled>
                                    {{ $t('569d1c4a-9389-47dd-9acb-930419271276') }}
                                </option>

                                <optgroup v-for="group in availableTypes" :key="group.name" :label="group.name">
                                    <option v-for="_type in group.types" :key="_type.value" :value="_type.value">
                                        {{ _type.name }}
                                    </option>
                                </optgroup>
                            </Dropdown>
                        </STInputBox>
                        <p class="style-description-small">
                            {{ $t('3f538b2d-e68f-4b87-917d-169305dfa42e') }}
                        </p>

                        <STInputBox v-if="type === 'Youth' && isBelgium" error-fields="umbrellaOrganization" :error-box="errorBox" :title="$t(`a5f71b13-f443-488a-81a4-62cf2498d9af`)">
                            <Dropdown v-model="umbrellaOrganization" data-testid="organization-umbrella-select">
                                <option :value="null" disabled>
                                    {{ $t('569d1c4a-9389-47dd-9acb-930419271276') }}
                                </option>
                                <option v-for="item in availableUmbrellaOrganizations" :key="item.value" :value="item.value">
                                    {{ item.name }}
                                </option>
                            </Dropdown>
                        </STInputBox>
                    </div>
                </div>

                <template v-if="!validatedRegisterCode">
                    <hr><h2>{{ $t('937b407c-7681-45c1-8c29-f415cf03faaf') }}</h2>

                    <Checkbox :model-value="getBooleanType(AcquisitionType.Recommended)" data-testid="acquisition-recommended-checkbox" @update:model-value="setBooleanType(AcquisitionType.Recommended, $event)">
                        {{ $t('05479234-2977-4bfd-a44b-924b01021b6e') }}
                    </Checkbox>
                    <Checkbox :model-value="getBooleanType(AcquisitionType.Seen)" data-testid="acquisition-seen-checkbox" @update:model-value="setBooleanType(AcquisitionType.Seen, $event)">
                        {{ $t('c82d1491-73f8-4f05-af15-5b7bf58f1bcb') }}
                    </Checkbox>
                    <Checkbox :model-value="getBooleanType(AcquisitionType.SocialMedia)" data-testid="acquisition-social-media-checkbox" @update:model-value="setBooleanType(AcquisitionType.SocialMedia, $event)">
                        {{ $t('d57a2f00-6cf5-4f37-b532-31fe5fae4946') }}
                    </Checkbox>
                    <Checkbox :model-value="getBooleanType(AcquisitionType.Search)" data-testid="acquisition-search-checkbox" @update:model-value="setBooleanType(AcquisitionType.Search, $event)">
                        {{ $t('90816551-3afb-44d2-b698-bef4a73d36b3') }}
                    </Checkbox>
                    <Checkbox :model-value="getBooleanType(AcquisitionType.Other)" data-testid="acquisition-other-checkbox" @update:model-value="setBooleanType(AcquisitionType.Other, $event)">
                        {{ $t('8f7475aa-c110-49b2-8017-1a6dd0fe72f9') }}
                    </Checkbox>
                </template>
            </main>

            <STToolbar>
                <template #right>
                    <LoadingButton :loading="loading">
                        <button class="button primary" type="submit" data-testid="signup-next-button" @click.prevent="goNext">
                            {{ $t('c34ab59f-979c-45e7-acd2-60ff24fc0705') }}
                        </button>
                    </LoadingButton>
                </template>
            </STToolbar>
        </form>
    </LoadingViewTransition>
</template>

<script lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins, Prop } from '@simonbackx/vue-app-navigation/classes';
import { AddressInput, BackButton, CenteredMessage, Checkbox, Dropdown, ErrorBox, LoadingButton, LoadingViewTransition, Slider, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, Validator } from '@stamhoofd/components';
import { I18nController } from '@stamhoofd/frontend-i18n';
import { NetworkManager, Storage } from '@stamhoofd/networking';
import { AcquisitionType, Address, Country, Organization, OrganizationMetaData, OrganizationPrivateMetaData, OrganizationType, OrganizationTypeHelper, RecordConfigurationFactory, RegisterCode, UmbrellaOrganization, UmbrellaOrganizationHelper } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';

import SignupAccountView from './SignupAccountView.vue';

@Component({
    components: {
        STToolbar,
        STNavigationBar,
        Slider,
        STErrorsDefault,
        STInputBox,
        BackButton,
        AddressInput,
        LoadingButton,
        Checkbox,
        Dropdown,
        LoadingViewTransition,
    },
    metaInfo() {
        return {
            title: 'Sluit jouw vereniging aan | Stamhoofd',
            meta: [
                {
                    vmid: 'description',
                    name: 'description',
                    content: 'Maak een gratis account aan om alles van Stamhoofd uit te proberen. Geheel zonder verplichtingen.',
                },
            ],
        };
    },
    navigation: {
        title: 'Sluit jouw vereniging aan | Stamhoofd',
    },
})
export default class SignupGeneralView extends Mixins(NavigationMixin) {
    name = '';
    validator = new Validator();
    errorBox: ErrorBox | null = null;
    address: Address | null = null;
    acquisitionTypes: AcquisitionType[] = [];

    @Prop({ default: false })
    visitViaUrl!: boolean;

    @Prop({ default: null })
    initialRegisterCode!: { code: string; organization: string } | null;

    registerCode = this.initialRegisterCode;

    validatedRegisterCode: null | RegisterCode = null;

    reuseRegisterCode = false;

    loading = false;
    loadingRegisterCode = true;

    // Make reactive
    I18nController = I18nController.shared;

    type: OrganizationType | null = null;
    umbrellaOrganization: UmbrellaOrganization | null = null;

    mounted() {
        this.loadRegisterCode().catch((e) => {
            console.error(e);
        });
    }

    async loadRegisterCode() {
        this.loadingRegisterCode = true;

        if (this.initialRegisterCode) {
            try {
                await Storage.keyValue.setItem('savedRegisterCode', JSON.stringify(this.initialRegisterCode));
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
                            this.registerCode = JSON.parse(saved);
                        }
                        else {
                            this.reuseRegisterCode = true;
                            this.registerCode = null;
                        }
                    }
                }
                else {
                    // Expired or invalid
                    await Storage.keyValue.removeItem('savedRegisterCode');
                    await Storage.keyValue.removeItem('savedRegisterCodeDate');
                    this.registerCode = null;
                }
            }
            else {
                await Storage.keyValue.removeItem('savedRegisterCode');
                await Storage.keyValue.removeItem('savedRegisterCodeDate');
                this.registerCode = null;
            }
        }
        catch (e) {
            console.error(e);
        }

        if (this.registerCode) {
            try {
                await this.validateCode();
            }
            catch (e) {
                this.errorBox = new ErrorBox(e);
                this.registerCode = null;
                await Storage.keyValue.removeItem('savedRegisterCode');
                await Storage.keyValue.removeItem('savedRegisterCodeDate');
            }
        }
        this.loadingRegisterCode = false;
    }

    get isBelgium() {
        return I18nController.shared.countryCode === Country.Belgium && (!this.address || this.address.country === Country.Belgium);
    }

    get AcquisitionType() {
        return AcquisitionType;
    }

    async validateCode() {
        // Check register code
        if (this.registerCode) {
            try {
                const response = await NetworkManager.server.request({
                    method: 'GET',
                    path: '/register-code/' + encodeURIComponent(this.registerCode.code.toUpperCase()),
                    decoder: RegisterCode as Decoder<RegisterCode>,
                });
                this.validatedRegisterCode = response.data;
                this.acquisitionTypes = [AcquisitionType.Recommended];
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

    async goNext() {
        if (this.loading) {
            return;
        }

        try {
            if (this.name.length === 0) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: '',
                    human: 'Vul de naam van jouw vereniging in',
                    field: 'name',
                });
            }
            if (this.name.length < 4) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: '',
                    human: 'De naam van jouw vereniging is te kort',
                    field: 'name',
                });
            }

            if (this.type === null) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'Maak een keuze',
                    field: 'type',
                });
            }

            if (this.type === OrganizationType.Youth && this.isBelgium) {
                if (this.umbrellaOrganization === null) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        message: 'Maak een keuze',
                        field: 'umbrellaOrganization',
                    });
                }
            }
            else {
                this.umbrellaOrganization = null;
            }

            this.loading = true;
            this.errorBox = null;

            if (!await this.validator.validate() || !this.address) {
                this.loading = false;
                return;
            }

            // Check register code
            try {
                await this.validateCode();
            }
            catch (e) {
                this.errorBox = new ErrorBox(e);
                this.loading = false;
                return;
            }

            const defaultStartDate = new Date();
            defaultStartDate.setMonth(defaultStartDate.getMonth() + 1);
            defaultStartDate.setDate(1);

            const defaultEndDate = new Date(defaultStartDate.getTime());
            defaultEndDate.setFullYear(defaultStartDate.getFullYear() + 1);

            const organization = Organization.create({
                name: this.name,
                uri: '', // ignored by backend for now
                meta: OrganizationMetaData.create({
                    type: this.type,
                    umbrellaOrganization: this.umbrellaOrganization,
                    recordsConfiguration: RecordConfigurationFactory.create(this.type, this.address.country),
                    defaultStartDate,
                    defaultEndDate,
                }),
                privateMeta: OrganizationPrivateMetaData.create({
                    acquisitionTypes: this.acquisitionTypes,
                }),
                address: this.address,
            });

            this.loading = false;
            this.errorBox = null;
            this.show(new ComponentWithProperties(SignupAccountView, { organization, registerCode: this.registerCode }));
            plausible('signupGeneral');
        }
        catch (e) {
            this.loading = false;
            console.error(e);
            this.errorBox = new ErrorBox(e);
            plausible('signupGeneralError');

            if (STAMHOOFD.environment === 'development' && this.name.length === 0) {
                console.log('Autofill for development mode enabled. Filling in default values...');
                // Autofill all
                this.name = 'Testvereniging ' + Math.floor(Math.random() * 100000);
                this.address = Address.create({
                    street: 'Teststraat',
                    number: '1',
                    postalCode: '9000',
                    city: 'Gent',
                    country: Country.Belgium,
                });
                this.type = OrganizationType.Other;
            }
            return;
        }
    }

    get availableTypes() {
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
    }

    get availableUmbrellaOrganizations() {
        return UmbrellaOrganizationHelper.getList().sort((a, b) =>
            Sorter.stack(
                Sorter.byBooleanValue(
                    !a.name.toLowerCase().startsWith('andere'),
                    !b.name.toLowerCase().startsWith('andere'),
                ),
                Sorter.byStringProperty(a, b, 'name'),
            ),
        );
    }

    async shouldNavigateAway() {
        if (this.name === '' && this.address === null && this.type === null) {
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

    getBooleanType(type: AcquisitionType) {
        return !!this.acquisitionTypes.find(r => r === type);
    }

    setBooleanType(type: AcquisitionType, enabled: boolean) {
        const index = this.acquisitionTypes.findIndex(r => r === type);
        if ((index !== -1) === enabled) {
            return;
        }

        if (enabled) {
            this.acquisitionTypes.push(type);
        }
        else {
            this.acquisitionTypes.splice(index, 1);
        }
    }
}
</script>
