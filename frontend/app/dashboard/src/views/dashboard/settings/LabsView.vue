<template>
    <SaveView :loading="saving" :disabled="!hasChanges" @save="save" :title="$t(`Experimenten`)">
        <h1>
            {{ $t('361fe588-e3b6-41d0-a0fa-b10382b21ae9') }}
        </h1>

        <p>{{ $t('d98017d4-cff4-4baf-a22b-8cf1bad1b56e') }}</p>

        <STErrorsDefault :error-box="errorBox"/>

        <hr><h2>{{ $t('2eeabef1-4dae-4639-8048-1930b2d3842f') }}</h2>

        <STList class="illustration-list">
            <STListItem :selectable="true" class="left-center" @click="openApiUsers(true)">
                <template #left>
                    <img src="@stamhoofd/assets/images/illustrations/laptop.svg"></template>
                <h2 class="style-title-list">
                    {{ $t('b97d8955-5ce5-435f-ba7d-f3899afb953f') }}
                </h2>
                <p class="style-description">
                    {{ $t('4d995169-f792-40f5-addf-60d8aed00362') }}
                </p>
                <template #right>
                    <span class="icon arrow-right-small gray"/>
                </template>
            </STListItem>

            <STListItem v-if="isStamhoofd" :selectable="true" class="left-center" @click="downloadSettings(true)">
                <template #left>
                    <img src="@stamhoofd/assets/images/illustrations/box-download.svg"></template>
                <h2 class="style-title-list">
                    {{ $t('eef6ca01-e35d-4483-a34d-6d39def71332') }}
                </h2>
                <p class="style-description">
                    {{ $t('6006f5f2-a630-460b-8fe2-9a782afd1880') }}
                </p>
                <template #right>
                    <LoadingButton :loading="downloadingSettings">
                        <span class="icon download gray"/>
                    </LoadingButton>
                </template>
            </STListItem>

            <STListItem v-if="isStamhoofd" :selectable="true" class="left-center" @click="uploadSettings(true)">
                <template #left>
                    <img src="@stamhoofd/assets/images/illustrations/box-upload.svg"></template>
                <h2 class="style-title-list">
                    {{ $t('07f69aa9-16c2-467e-ab30-e0c5a25012d6') }}
                </h2>
                <p class="style-description">
                    {{ $t('990305de-65df-4625-93fc-f013e561620b') }}
                </p>
                <template #right>
                    <LoadingButton :loading="uploadingSettings">
                        <span class="icon upload gray"/>
                    </LoadingButton>
                </template>
            </STListItem>
        </STList>

        <hr><h2>{{ $t('b63ed24b-7398-4ddf-afb4-38cb55e2269c') }}</h2>

        <STList>
            <STListItem v-if="!enableBuckaroo && false" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="forceMollie"/>
                </template>

                <h3 class="style-title-list">
                    {{ $t('a834e978-63ab-4409-b1ff-99206551eedf') }}
                </h3>

                <p class="style-description-small">
                    {{ $t('a1829d0f-6a34-4906-aef3-6bc4079732fb') }} <a :href="$domains.getDocs('transactiekosten')" class="inline-link" target="_blank">{{ $t('34099e11-aafe-435c-bd11-5b681610008e') }}</a>
                </p>
            </STListItem>

            <STListItem v-if="!enableBuckaroo" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox :model-value="getFeatureFlag('webshop-discounts')" @update:model-value="setFeatureFlag('webshop-discounts', !!$event)"/>
                </template>

                <h3 class="style-title-list">
                    {{ $t('ded66dc6-f0b5-43e3-a58a-6914749d1ba3') }}
                </h3>

                <p class="style-description-small">
                    {{ $t('315d10a0-732d-4d15-88ba-58e1a4fc90d3') }} <a href="https://feedback.stamhoofd.app/48" class="inline-link" target="_blank">{{ $t('495913cb-41a9-4e02-a161-033377806d35') }}</a>
                </p>
            </STListItem>
        </STList>

        <div v-if="isStamhoofd" key="stamhoofd-settings" class="container">
            <hr><h2>
                {{ $t('cabf766a-9ac8-4622-9066-47a52270b0b0') }}
            </h2>

            <Checkbox v-model="useTestPayments">
                {{ $t('7edd7721-1b57-48fd-b200-2cbbdbc22ecf') }}
            </Checkbox>

            <Checkbox :model-value="getFeatureFlag('documents')" @update:model-value="setFeatureFlag('documents', !!$event)">
                {{ $t('eeb261d4-2a8d-46f3-ae06-f294fa1721a6') }}
            </Checkbox>

            <Checkbox :model-value="getFeatureFlag('cached-outstanding-balances')" @update:model-value="setFeatureFlag('cached-outstanding-balances', !!$event)">
                {{ $t('adc95cc6-1847-4148-a5c6-0dcfb8b5f9d9') }}
            </Checkbox>

            <Checkbox :model-value="getFeatureFlag('sso')" @update:model-value="setFeatureFlag('sso', !!$event)">
                {{ $t('e0a3fd15-c83a-44bb-8c27-9d97773d27f6') }}
            </Checkbox>

            <Checkbox :model-value="getFeatureFlag('webshop-auth')" @update:model-value="setFeatureFlag('webshop-auth', !!$event)">
                {{ $t('1e20bd1c-c7cd-4d6a-9434-da95ec121bc6') }}
            </Checkbox>

            <Checkbox :model-value="getFeatureFlag('organization-receivable-balances')" @update:model-value="setFeatureFlag('organization-receivable-balances', !!$event)">
                {{ $t('d441508b-c8a4-4de8-b23e-8edfe4157568') }}
            </Checkbox>

            <hr><button class="button text" type="button" @click="applyDiscountCode">
                <span class="icon gift"/><span>{{ $t('15f84aba-e6d8-4d20-8c28-2195fd0e4abe') }}</span>
            </button>
        </div>
    </SaveView>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, Decoder, ObjectData, patchContainsChanges, VersionBox, VersionBoxDecoder } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Request } from '@simonbackx/simple-networking';
import { ComponentWithProperties, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins } from '@simonbackx/vue-app-navigation/classes';
import { CenteredMessage, Checkbox, ErrorBox, InputSheet, LoadingButton, SaveView, STErrorsDefault, STInputBox, STList, STListItem, Toast, Validator } from '@stamhoofd/components';
import { Country, Organization, OrganizationMetaData, OrganizationPatch, OrganizationPrivateMetaData, PrivatePaymentConfiguration, Version } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import ApiUsersView from '../admins/ApiUsersView.vue';

@Component({
    components: {
        SaveView,
        STInputBox,
        STErrorsDefault,
        STList,
        STListItem,
        Checkbox,
        LoadingButton,
    },
})
export default class LabsView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null;
    validator = new Validator();
    saving = false;
    downloadingSettings = false;
    uploadingSettings = false;
    organizationPatch: AutoEncoderPatchType<Organization> & AutoEncoder = OrganizationPatch.create({});

    created() {
        this.organizationPatch.id = this.$organization.id;
    }

    get organization() {
        return this.$organization.patch(this.organizationPatch);
    }

    openApiUsers(animated = true) {
        this.show({
            components: [
                new ComponentWithProperties(ApiUsersView, {}),
            ],
            animated,
        });
    }

    get isBelgium() {
        return this.organization.address.country === Country.Belgium;
    }

    get isStamhoofd() {
        return this.$organizationManager.user.email.endsWith('@stamhoofd.be') || this.$organizationManager.user.email.endsWith('@stamhoofd.nl');
    }

    get enableBuckaroo() {
        return (this.organization.privateMeta?.buckarooSettings ?? null) !== null;
    }

    get forceMollie() {
        return this.organization.privateMeta?.featureFlags.includes('forceMollie') ?? false;
    }

    set forceMollie(forceMollie: boolean) {
        const featureFlags = this.organization.privateMeta?.featureFlags.filter(f => f !== 'forceMollie') ?? [];
        if (forceMollie) {
            featureFlags.push('forceMollie');
        }
        this.organizationPatch = this.organizationPatch.patch({
            privateMeta: OrganizationPrivateMetaData.patch({
                featureFlags: featureFlags as any,
            }),
        });
    }

    get forcePayconiq() {
        return this.getFeatureFlag('forcePayconiq');
    }

    set forcePayconiq(forcePayconiq: boolean) {
        this.setFeatureFlag('forcePayconiq', forcePayconiq);
    }

    getFeatureFlag(flag: string) {
        return this.organization.privateMeta?.featureFlags.includes(flag) ?? false;
    }

    setFeatureFlag(flag: string, value: boolean) {
        const featureFlags = this.organization.privateMeta?.featureFlags.filter(f => f !== flag) ?? [];
        if (value) {
            featureFlags.push(flag);
        }
        this.organizationPatch = this.organizationPatch.patch({
            privateMeta: OrganizationPrivateMetaData.patch({
                featureFlags: featureFlags as any,
            }),
        });
    }

    get useTestPayments() {
        return this.organization.privateMeta?.useTestPayments ?? STAMHOOFD.environment !== 'production';
    }

    set useTestPayments(useTestPayments: boolean) {
        this.organizationPatch = this.organizationPatch.patch({
            privateMeta: OrganizationPrivateMetaData.patch({
                // Only save non default value
                useTestPayments: STAMHOOFD.environment !== 'production' === useTestPayments ? null : useTestPayments,
            }),
        });
    }

    async save() {
        if (this.saving) {
            return;
        }

        const errors = new SimpleErrors();

        let valid = false;

        if (errors.errors.length > 0) {
            this.errorBox = new ErrorBox(errors);
        }
        else {
            this.errorBox = null;
            valid = true;
        }
        valid = valid && await this.validator.validate();

        if (!valid) {
            return;
        }

        this.saving = true;

        try {
            await this.$organizationManager.patch(this.organizationPatch);
            this.organizationPatch = OrganizationPatch.create({ id: this.$organization.id });
            new Toast('De wijzigingen zijn opgeslagen', 'success green').show();
            this.dismiss({ force: true });
        }
        catch (e) {
            this.errorBox = new ErrorBox(e);
        }

        this.saving = false;
    }

    get hasChanges() {
        return patchContainsChanges(this.organizationPatch, this.$organization, { version: Version });
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true;
        }
        return await CenteredMessage.confirm('Ben je zeker dat je wilt sluiten zonder op te slaan?', 'Niet opslaan');
    }

    beforeUnmount() {
        Request.cancelAll(this);
    }

    downloadSettings() {
        if (this.downloadingSettings) {
            return;
        }

        // Remove private data
        const organization = Organization.create({
            ...this.$organization,
            admins: [],
            webshops: [],
        });

        // Delete private tokens
        organization.privateMeta!.payconiqAccounts = [];
        organization.privateMeta!.buckarooSettings = null;
        organization.privateMeta!.mollieProfile = null;
        organization.privateMeta!.registrationPaymentConfiguration = PrivatePaymentConfiguration.create({});

        const versionBox = new VersionBox(organization);

        // Create a clean JSON file
        const string = JSON.stringify(versionBox.encode({ version: Version }), null, 2);

        // Create a blob
        const blob = new Blob([string], { type: 'application/json' });

        // Trigger a download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = Formatter.fileSlug(this.organization.name) + '.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    uploadSettings() {
        // Trigger a file input of a file with type .json
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (event: any) => {
            if (!event || !event.target || !event.target.files || event.target.files.length !== 1) {
                return;
            }
            const file = event.target.files[0] as File;
            const reader = new FileReader();
            reader.onload = async (event) => {
                const data = event.target!.result as string;
                try {
                    this.uploadingSettings = true;
                    const parsed = JSON.parse(data);

                    try {
                        await this.doUploadSettings(parsed);
                        new Toast('De instellingen zijn geïmporteerd', 'success green').show();
                    }
                    catch (e) {
                        Toast.fromError(e).show();
                    }
                }
                catch (e) {
                    Toast.fromError(new SimpleError({
                        code: 'invalid_json',
                        message: 'Het bestand is geen geldig JSON-bestand',
                    })).show();
                }
                this.uploadingSettings = false;
            };
            reader.readAsText(file);
        };
        input.click();
    }

    async doUploadSettings(blob: any) {
        // Decode
        let organization: Organization;
        try {
            const decodedOrganization = new VersionBoxDecoder(Organization as Decoder<Organization>).decode(new ObjectData(blob, { version: 0 }));
            organization = decodedOrganization.data;
        }
        catch (e) {
            throw new SimpleError({
                code: 'invalid_json',
                message: 'Het bestand is geen geldige export: ' + e.getMessage(),
            });
        }

        const existing = this.$organization;

        const privatePatch = OrganizationPrivateMetaData.patch({});

        // Add emails
        for (const email of organization.privateMeta?.emails ?? []) {
            if (!existing.privateMeta?.emails.find(e => e.email === email.email)) {
                // Only add if it doesn't exist yet
                privatePatch.emails.addPut(email);
            }
        }

        // Add roles
        for (const role of organization.privateMeta?.roles ?? []) {
            if (!existing.privateMeta?.roles.find(r => r.id === role.id)) {
                // Only add if it doesn't exist yet
                privatePatch.roles.addPut(role);
            }
        }

        // Add featureFlags
        for (const featureFlag of organization.privateMeta?.featureFlags ?? []) {
            if (!existing.privateMeta?.featureFlags.includes(featureFlag)) {
                // Only add if it doesn't exist yet
                privatePatch.featureFlags.addPut(featureFlag);
            }
        }

        const meta = {
            ...organization.meta,
        } as any;
        delete meta.registrationPaymentConfiguration;

        const organizationPatch = Organization.patch({
            id: existing.id,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            meta: OrganizationMetaData.patch(meta),
            privateMeta: privatePatch,
            name: organization.name,
            address: organization.address,
            website: organization.website,
            uri: organization.uri,
        });

        // Copy over groups
        for (const group of organization.groups) {
            if (!existing.groups.find(g => g.id === group.id)) {
                // Only add if it doesn't exist yet
                organizationPatch.groups.addPut(group);
            }
        }

        // Send to server
        await this.$organizationManager.patch(organizationPatch);
    }

    applyDiscountCode() {
        this.present({
            components: [
                new ComponentWithProperties(InputSheet, {
                    title: 'Kortingscode toepassen',
                    description: 'De kortingscode zal meteen worden toegepast op deze vereniging. De andere vereniging ontvangt een e-mail dat de kortingscode is gebruikt, en zal meteen tegoed ontvangen als de vereniging al een betalende klant is (in het andere geval pas later).',
                    placeholder: 'Vul hier de code in',
                    saveHandler: async (code: string) => {
                        await this.$context.authenticatedServer.request({
                            method: 'POST',
                            path: '/organization/register-code',
                            body: {
                                registerCode: code,
                            },
                        });
                        new Toast('De kortingscode is toegepast', 'success green').show();
                    },
                }),
            ],
            modalDisplayStyle: 'sheet',
        });
    }
}
</script>
