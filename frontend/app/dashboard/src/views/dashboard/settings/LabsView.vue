<template>
    <SaveView :loading="saving" :disabled="!hasChanges" :title="$t(`%HD`)" @save="save">
        <h1>
            {{ $t('%HD') }}
        </h1>

        <p>{{ $t('%HE') }}</p>

        <STErrorsDefault :error-box="errorBox" />

        <hr><h2>{{ $t('%NN') }}</h2>

        <STList class="illustration-list">
            <STListItem :selectable="true" class="left-center" @click="openApiUsers(true)">
                <template #left>
                    <img src="@stamhoofd/assets/images/illustrations/laptop.svg">
                </template>
                <h2 class="style-title-list">
                    {{ $t('%K0') }}
                </h2>
                <p class="style-description">
                    {{ $t('%5P') }}
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
                    {{ $t('%NO') }}
                </h2>
                <p class="style-description">
                    {{ $t('%NP') }}
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
                    {{ $t('%18k') }}
                </h2>
                <p class="style-description">
                    {{ $t('%NQ') }}
                </p>
                <template #right>
                    <LoadingButton :loading="uploadingSettings">
                        <span class="icon upload gray" />
                    </LoadingButton>
                </template>
            </STListItem>
        </STList>

        <hr><h2>{{ $t('%NR') }}</h2>

        <div v-if="isStamhoofd" key="stamhoofd-settings" class="container">
            <hr><h2>
                {{ $t('%NU') }}
            </h2>

            <STList>
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox :model-value="getFeatureFlag('vat')" @update:model-value="setFeatureFlag('vat', !!$event)" />
                    </template>

                    <h3 class="style-title-list">
                        {{ $t('%1Hp') }} (wip)
                    </h3>

                    <p class="style-description-small">
                        {{ $t('%1Hq') }}
                    </p>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox v-model="useTestPayments" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('%NV') }}
                    </h3>

                    <p class="style-description-small">
                        {{ $t('%1Hr') }}
                    </p>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox :model-value="getFeatureFlag('sso')" @update:model-value="setFeatureFlag('sso', !!$event)" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('%1O') }}
                    </h3>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox :model-value="getFeatureFlag('webshop-auth')" @update:model-value="setFeatureFlag('webshop-auth', !!$event)" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('%10') }}
                    </h3>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox :model-value="getFeatureFlag('organization-receivable-balances')" @update:model-value="setFeatureFlag('organization-receivable-balances', !!$event)" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('%NW') }}
                    </h3>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox :model-value="getFeatureFlag('email-to-payments')" @update:model-value="setFeatureFlag('email-to-payments', !!$event)" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('%1Lu') }}
                    </h3>
                </STListItem>
            </STList>

            <hr><button class="button text" type="button" @click="applyDiscountCode">
                <span class="icon gift" /><span>{{ $t('%NX') }}</span>
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
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { Validator } from '@stamhoofd/components/errors/Validator.ts';
import Checkbox from '@stamhoofd/components/inputs/Checkbox.vue';
import STInputBox from '@stamhoofd/components/inputs/STInputBox.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import LoadingButton from '@stamhoofd/components/navigation/LoadingButton.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import InputSheet from '@stamhoofd/components/overlays/InputSheet.vue';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
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
