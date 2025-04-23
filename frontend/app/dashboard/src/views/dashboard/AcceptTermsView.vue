<template>
    <SaveView :loading="loading" :title="$t(`4b52f8cb-2b1a-42ff-ab7e-c209e7874649`)" @save="save">
        <h1>
            {{ $t('770381c5-61af-483c-a21f-f55a63baba3a') }}
        </h1>

        <p>
            {{ $t('2615ff5c-0ef3-4c6d-87c7-3caf7671a94a') }}
        </p>
        <STErrorsDefault :error-box="errorBox" />

        <Checkbox v-model="acceptPrivacy" class="long-text">
            {{ $t('df2f7ae1-ad07-4ec4-94c0-939dd3f6bc8d') }} <a class="inline-link" :href="'https://'+$domains.marketing+'/terms/privacy'" target="_blank">{{ $t('005c5e2d-8185-46e7-b1a0-4e4eaaf60d41') }}</a>.
        </Checkbox>

        <Checkbox v-model="acceptTerms" class="long-text">
            {{ $t('b22d5516-2644-4f4a-bcb5-ad93b82a0d61') }} <a class="inline-link" :href="'https://'+$domains.marketing+'/terms/algemene-voorwaarden'" target="_blank">{{ $t('1943d3e6-4550-4240-b2f7-5aaa74e55f5d') }}</a> {{ $t('da2d2d9e-07cc-471e-963a-7915c7698ba9') }}
        </Checkbox>

        <Checkbox v-model="acceptDataAgreement" class="long-text">
            {{ $t('b22d5516-2644-4f4a-bcb5-ad93b82a0d61') }} <a class="inline-link" :href="'https://'+$domains.marketing+'/terms/verwerkersovereenkomst'" target="_blank">{{ $t('2b08e5d7-6acc-4d7f-ad1a-30f349a79fe9') }}</a> {{ $t('da2d2d9e-07cc-471e-963a-7915c7698ba9') }}
        </Checkbox>
    </SaveView>
</template>

<script lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins } from '@simonbackx/vue-app-navigation/classes';
import { Checkbox, ErrorBox, ReplaceRootEventBus, STErrorsDefault, SaveView } from '@stamhoofd/components';
import { Organization, OrganizationMetaData } from '@stamhoofd/structures';
import { getOrganizationSelectionRoot } from '../../getRootViews';

@Component({
    components: {
        SaveView,
        Checkbox,
        STErrorsDefault,
    },
})
export default class AcceptTermsView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null;

    acceptPrivacy = false;
    acceptTerms = false;
    acceptDataAgreement = false;
    loading = false;

    async save() {
        if (this.loading) {
            return;
        }

        try {
            this.loading = true;
            this.errorBox = null;

            if (!this.acceptPrivacy) {
                throw new SimpleError({
                    code: 'read_privacy',
                    message: $t(`ca416d8b-8535-4680-a421-3c49cfff8e55`),
                });
            }

            if (!this.acceptTerms) {
                throw new SimpleError({
                    code: 'read_privacy',
                    message: $t(`cebbc813-84c2-4f11-a144-1d1632bfb0f5`),
                });
            }

            if (!this.acceptDataAgreement) {
                throw new SimpleError({
                    code: 'read_privacy',
                    message: $t(`92e9d94a-20c9-482a-a528-fd3c8a8fdded`),
                });
            }

            await this.$organizationManager.patch(
                Organization.patch({
                    id: this.$organization.id,
                    meta: OrganizationMetaData.patch({
                        lastSignedTerms: new Date(),
                    }),
                }),
                false,
            );
            this.pop({ force: true });
        }
        catch (e) {
            this.loading = false;
            console.error(e);
            this.errorBox = new ErrorBox(e);
            return;
        }
    }

    async shouldNavigateAway() {
        // Force session logout
        await ReplaceRootEventBus.sendEvent('replace', getOrganizationSelectionRoot());
        return true;
    }
}
</script>
