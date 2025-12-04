<template>
    <SaveView :loading="saving" :disabled="!hasChanges" :title="$t(`e58db898-16ad-4bb4-840c-2315ca894ff6`)" @save="save">
        <h1>
            {{ $t('5a5c1ed2-516e-43a1-9e64-25a7f6190ed3') }}
        </h1>

        <p>{{ $t('cdd2999b-28bf-4b9b-ba31-371cd3021923') }}</p>

        <STErrorsDefault :error-box="errorBox" />

        <hr><h2>{{ $t('e580ade8-d2b5-44e0-b712-2e66f5bce0c6') }}</h2>

        <STList class="illustration-list">
            <STListItem :selectable="true" class="left-center" @click="openApiUsers(true)">
                <template #left>
                    <img src="@stamhoofd/assets/images/illustrations/laptop.svg">
                </template>
                <h2 class="style-title-list">
                    {{ $t('a5b3b5e6-70c0-4818-9548-01f810477cd2') }}
                </h2>
                <p class="style-description">
                    {{ $t('4d995169-f792-40f5-addf-60d8aed00362') }}
                </p>
                <template #right>
                    <span class="icon arrow-right-small gray" />
                </template>
            </STListItem>

            <STListItem v-if="isStamhoofd" :selectable="true" class="left-center" @click="downloadSettings()">
                <template #left>
                    <img src="@stamhoofd/assets/images/illustrations/box-download.svg">
                </template>
                <h2 class="style-title-list">
                    {{ $t('a6b4a111-2b23-4f15-bfb9-45c784a7159b') }}
                </h2>
                <p class="style-description">
                    {{ $t('1985f023-e846-4ea2-9526-b24358c7a294') }}
                </p>
                <template #right>
                    <LoadingButton :loading="downloadingSettings">
                        <span class="icon download gray" />
                    </LoadingButton>
                </template>
            </STListItem>

            <STListItem v-if="isStamhoofd" :selectable="true" class="left-center" @click="uploadSettings()">
                <template #left>
                    <img src="@stamhoofd/assets/images/illustrations/box-upload.svg">
                </template>
                <h2 class="style-title-list">
                    {{ $t('7b742cf1-1f8d-4848-b893-db0f34dac948') }}
                </h2>
                <p class="style-description">
                    {{ $t('2dc53487-2eb6-408c-beef-5e00c7a4b5b9') }}
                </p>
                <template #right>
                    <LoadingButton :loading="uploadingSettings">
                        <span class="icon upload gray" />
                    </LoadingButton>
                </template>
            </STListItem>
        </STList>

        <hr><h2>{{ $t('ae010586-e7f2-4551-a486-77d4a92ec76b') }}</h2>

        <STList>
            <STListItem v-if="!enableBuckaroo && false" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="forceMollie" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('55aa8ece-1684-4c56-81ff-5fb40758d0fa') }}
                </h3>

                <p class="style-description-small">
                    {{ $t('76a35b17-68d8-4d2f-8022-755b4033dc46') }} <a :href="$domains.getDocs('transactiekosten')" class="inline-link" target="_blank">{{ $t('a36700a3-64be-49eb-b1fd-60af7475eb4e') }}</a>
                </p>
            </STListItem>
        </STList>

        <div v-if="isStamhoofd" key="stamhoofd-settings" class="container">
            <hr><h2>
                {{ $t('a0044037-18fd-465d-8907-9f7064342279') }}
            </h2>

            <STList>
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox :model-value="getFeatureFlag('vat')" @update:model-value="setFeatureFlag('vat', !!$event)" />
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('f7fe1fae-5b35-4491-9184-ab47b9c8f4ce') }} (wip)
                    </h3>

                    <p class="style-description-small">
                        {{ $t('584f3cc4-679e-4803-b923-033eb552aed5') }}
                    </p>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox v-model="useTestPayments" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('02fe4c35-562f-429c-9250-dbd25ca01357') }}
                    </h3>

                    <p class="style-description-small">
                        {{ $t('ff823505-f417-4e8c-a6bd-4eb05551c6cb') }}
                    </p>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox :model-value="getFeatureFlag('sso')" @update:model-value="setFeatureFlag('sso', !!$event)" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('8cdbbc91-88ab-4d25-8f42-b34369e959f0') }}
                    </h3>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox :model-value="getFeatureFlag('webshop-auth')" @update:model-value="setFeatureFlag('webshop-auth', !!$event)" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('5573d401-88aa-4221-9ed7-44380d970177') }}
                    </h3>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox :model-value="getFeatureFlag('organization-receivable-balances')" @update:model-value="setFeatureFlag('organization-receivable-balances', !!$event)" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('47e866d9-5349-4318-b779-161da61c2250') }}
                    </h3>
                </STListItem>
            </STList>

            <hr><button class="button text" type="button" @click="applyDiscountCode">
                <span class="icon gift" /><span>{{ $t('5a58b689-5269-40a0-907e-c977b293c2fa') }}</span>
            </button>
        </div>
    </SaveView>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, Decoder, ObjectData, patchContainsChanges, VersionBox, VersionBoxDecoder } from '@simonbackx/simple-encoding';
import { isSimpleError, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Request } from '@simonbackx/simple-networking';
import { ComponentWithProperties, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins } from '@simonbackx/vue-app-navigation/classes';
import { CenteredMessage, Checkbox, ErrorBox, InputSheet, LoadingButton, SaveView, STErrorsDefault, STInputBox, STList, STListItem, Toast, Validator } from '@stamhoofd/components';
import { Country, Organization, OrganizationMetaData, OrganizationPrivateMetaData, PrivatePaymentConfiguration, Version } from '@stamhoofd/structures';
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
    organizationPatch: AutoEncoderPatchType<Organization> & AutoEncoder = Organization.patch({});

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
            this.organizationPatch = Organization.patch({ id: this.$organization.id });
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
                message: 'Het bestand is geen geldige export: ' + (isSimpleError(e) ? e.getHuman() : e),
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
