<template>
    <SaveView :loading="loading" :error-box="errors.errorBox" save-icon-right="arrow-right" :save-text="$t('%16p')" data-submit-last-field :disabled="!acceptTerms" :title="$t(`Overzicht`)" @save="goNext">
        <h1>{{ $t('Overzicht') }}</h1>
        <p>
            <I18nComponent :t="$t('Meer info over alle prijzen en een prijscalculator kan je terugvinden op <button>onze website</button>')">
                <template #button="{content}">
                    <a :href="'https://'+ LocalizedDomains.marketing +'/prijzen'" class="inline-link" target="_blank">
                        {{ content }}
                    </a>
                </template>
            </I18nComponent>
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />


        <STList>
            <STPackageRow v-for="pack of model.packages" :key="pack.id" :pack="pack" />
        </STList>

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
import STPackageRow from '@stamhoofd/components/packages/STPackageRow.vue';
import type { NavigationActions } from '@stamhoofd/components/types/NavigationActions.ts';
import { useNavigationActions } from '@stamhoofd/components/types/NavigationActions.ts';
import { LocalizedDomains } from '@stamhoofd/frontend-i18n';
import { ref } from 'vue';
import type { PackageCheckoutViewModel } from '../PackageCheckoutViewModel';

const props = withDefaults(
    defineProps<{
        model: PackageCheckoutViewModel;
        saveHandler: (navigate: NavigationActions) => Promise<void>;
    }>(), {
    }
);

const errors = useErrors();
const loading = ref(false);

const navigate = useNavigationActions();
const acceptTerms = ref(false);

async function goNext() {
    if (loading.value) {
        return;
    }

    loading.value = true;
    errors.errorBox = null;

    try {
        // Check packages are fine (throws if renew or activation is not possible)
        props.model.validate();

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
