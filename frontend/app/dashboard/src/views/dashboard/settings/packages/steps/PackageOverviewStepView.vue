<template>
    <SaveView :loading="loading" :loading-view="!status" :error-box="errors.errorBox" save-icon-right="arrow-right" :save-text="$t('%16p')" data-submit-last-field :disabled="companies.length === 0" :title="$t(`%uE`)" @save="goNext">
        <h1>{{ $t('Overzicht') }}</h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <hr>
        <h2>{{ $t('Prijsoverzicht') }}</h2>
        <p>
            <I18nComponent :t="$t('Meer info over alle prijzen en een prijscalculator kan je terugvinden op <button>onze website</button>')">
                <template #button="{content}">
                    <a :href="'https://'+ LocalizedDomains.marketing +'/prijzen'" class="inline-link" target="_blank">
                        {{ content }}
                    </a>
                </template>
            </I18nComponent>
        </p>

        <STList>
            <STPackageRow v-for="pack of packages" :key="pack.id" :pack="pack" />
        </STList>

        <hr>
        <h2>{{ $t('Algemene voorwaarden') }}</h2>

        <STInputBox :error-box="errors.errorBox" error-fields="terms" class="max">
            <Checkbox v-model="acceptTerms">
                <I18nComponent :t="$t('Ik ga akkoord met de <button>algemene voorwaarden</button>')">
                    <template #button="{content}">
                        <a :href="'https://'+ LocalizedDomains.marketing +'/terms/algemene-voorwaarden'" target="_blank" class="inline-link">
                            {{ content }}
                        </a>
                    </template>
                </I18nComponent>
            </Checkbox>
        </STInputBox>
    </SaveView>
</template>

<script lang="ts" setup>
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { useOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import STPackageRow from '@stamhoofd/components/packages/STPackageRow.vue';
import type { NavigationActions } from '@stamhoofd/components/types/NavigationActions.ts';
import { useNavigationActions } from '@stamhoofd/components/types/NavigationActions.ts';
import { LocalizedDomains } from '@stamhoofd/frontend-i18n';
import type { PackageCheckout } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import { useOrganizationPackages } from '../hooks/useOrganizationPackages';

const props = withDefaults(
    defineProps<{
        checkout: PackageCheckout;
        saveHandler: (navigate: NavigationActions) => Promise<void>;
    }>(), {
    }
);

const errors = useErrors();
const { packages: status, reload } = useOrganizationPackages({ errors, onMounted: true });
const organization = useOrganization();
const loading = ref(false);
const navigate = useNavigationActions();
const companies = computed(() => organization.value?.meta.companies ?? []);

const acceptTerms = ref(false);

const packages = computed(() => {
    if (!status.value) {
        return [];
    }

    return props.checkout.purchases.getPackages(status.value);
});

async function goNext() {
    if (loading.value) {
        return;
    }

    loading.value = true;
    errors.errorBox = null;

    try {
        // todo: validate and modify checkout
        await props.saveHandler(navigate);
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    finally {
        loading.value = false;
    }
}

</script>
