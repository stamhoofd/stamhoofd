<template>
    <SaveView :loading="loading" @save="save" :title="$t(`beef9a38-2c2f-4c2c-a2b6-c0e448bc1a0d`)">
        <h1>
            {{ $t('dc74a214-71c0-4daa-83cb-6bc90444810f') }}
        </h1>

        <p>
            {{ $t('362621f4-52d2-4df6-acfd-24fe73c5872a') }}
        </p>
        <STErrorsDefault :error-box="errorBox"/>

        <Checkbox v-model="acceptPrivacy" class="long-text">
            {{ $t('5640d1b2-0dfa-4fb3-a5ea-71214bf2947b') }} <a class="inline-link" :href="'https://'+$domains.marketing+'/terms/privacy'" target="_blank">{{ $t('96072da2-bd1e-4bd8-99c9-0cd572f8c83f') }}</a>.
        </Checkbox>

        <Checkbox v-model="acceptTerms" class="long-text">
            {{ $t('a689c709-899c-4e83-aed4-2d22ebb52f18') }} <a class="inline-link" :href="'https://'+$domains.marketing+'/terms/algemene-voorwaarden'" target="_blank">{{ $t('31101e24-f2d3-4f54-af0a-7fadd2177236') }}</a> {{ $t('2a42726d-41b7-494a-be4f-0497471ba621') }}
        </Checkbox>

        <Checkbox v-model="acceptDataAgreement" class="long-text">
            {{ $t('a689c709-899c-4e83-aed4-2d22ebb52f18') }} <a class="inline-link" :href="'https://'+$domains.marketing+'/terms/verwerkersovereenkomst'" target="_blank">{{ $t('7add8ff4-5d9b-48a5-85d9-54580fda3a4b') }}</a> {{ $t('2a42726d-41b7-494a-be4f-0497471ba621') }}
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
                    message: 'Je moet kennis hebben genomen van het privacybeleid.',
                });
            }

            if (!this.acceptTerms) {
                throw new SimpleError({
                    code: 'read_privacy',
                    message: 'Je moet akkoord gaan met de algemene voorwaarden.',
                });
            }

            if (!this.acceptDataAgreement) {
                throw new SimpleError({
                    code: 'read_privacy',
                    message: 'Je moet akkoord gaan met de verwerkersovereenkomst.',
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
