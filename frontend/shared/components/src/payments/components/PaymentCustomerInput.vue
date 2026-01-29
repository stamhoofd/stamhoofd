<template>
    <div>
        <STInputBox error-fields="type" :error-box="errorBox">
            <div class="illustration-radio-container">
                <label class="illustration-radio-box">
                    <div>
                        <Radio v-model="hasCompany" :value="true" />
                    </div>
                    <figure>
                        <img src="~@stamhoofd/assets/images/illustrations/company.svg">
                    </figure>
                    <h3>{{ $t('Bedrijf of organisatie') }}</h3>
                </label>

                <label class="illustration-radio-box">
                    <div>
                        <Radio v-model="hasCompany" :value="false" />
                    </div>
                    <figure>
                        <img src="~@stamhoofd/assets/images/illustrations/user.svg">
                    </figure>
                    <h3>{{ $t('1474bb78-8f01-456a-9e85-c6b1748b76d5') }}</h3>
                </label>
            </div>
        </STInputBox>

        <template v-if="customer.company">
            <CompanyInputBox :validator="validator" :company="customer.company" @patch:company="addPatch({ company: $event })" />

            <template v-if="companyWithContectPreferred || !!firstName || !!lastName || !!phone || !!email">
                <STInputBox error-fields="firstName,lastName" :error-box="errorBox" :title="$t(`Contactpersoon`)">
                    <div class="input-group">
                        <div>
                            <input v-model="firstName" class="input" type="text" autocomplete="given-name" :placeholder="$t(`ca52d8d3-9a76-433a-a658-ec89aeb4efd5`)">
                        </div>
                        <div>
                            <input v-model="lastName" class="input" type="text" autocomplete="family-name" :placeholder="$t(`171bd1df-ed4b-417f-8c5e-0546d948469a`)">
                        </div>
                    </div>

                    <template #right>
                        <button v-tooltip="$t('Contactpersoon verwijderen')" type="button" class="button icon trash small" @click="removeContact" />
                    </template>
                </STInputBox>

                <EmailInput v-model="email" :validator="validator" autocomplete="email" :required="false" :title="$t(`7400cdce-dfb4-40e7-996b-4817385be8d8`)" :placeholder="$t(`Optioneel`)" />
                <PhoneInput v-model="phone" :validator="validator" autocomplete="phone" :required="false" :title="$t(`GSM-nummer`)" :placeholder="$t(`Optioneel`)" />
            </template>
            <button v-else type="button" class="button text" @click="enableContact">
                <span class="icon add" />
                <span>{{ $t('Contactpersoon') }}</span>
            </button>
        </template>
        <template v-else>
            <STInputBox error-fields="firstName,lastName" :error-box="errorBox" :title="$t(`Naam`)">
                <div class="input-group">
                    <div>
                        <input v-model="firstName" class="input" type="text" autocomplete="given-name" :placeholder="$t(`ca52d8d3-9a76-433a-a658-ec89aeb4efd5`)">
                    </div>
                    <div>
                        <input v-model="lastName" class="input" type="text" autocomplete="family-name" :placeholder="$t(`171bd1df-ed4b-417f-8c5e-0546d948469a`)">
                    </div>
                </div>
            </STInputBox>

            <EmailInput v-model="email" :validator="validator" autocomplete="email" :required="false" :title="$t(`7400cdce-dfb4-40e7-996b-4817385be8d8`)" :placeholder="$t(`Optioneel`)" />
            <PhoneInput v-model="phone" :validator="validator" autocomplete="phone" :required="false" :title="$t(`GSM-nummer`)" :placeholder="$t(`Optioneel`)" />
        </template>
    </div>
</template>

<script lang="ts" setup>
import { CompanyInputBox, EmailInput, ErrorBox, PhoneInput, STInputBox, useEmitPatch, Validator } from '@stamhoofd/components';
import { Company, PaymentCustomer } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

const props = withDefaults(defineProps<{
    customer: PaymentCustomer;
    validator: Validator;
    errorBox?: ErrorBox | null;
}>(), {
    errorBox: null,
});

const emit = defineEmits(['patch:customer']);
const { addPatch } = useEmitPatch<PaymentCustomer>(props, emit, 'customer');
const companyWithContectPreferred = ref(false);

function enableContact() {
    companyWithContectPreferred.value = true;
}

function removeContact() {
    companyWithContectPreferred.value = false;
    firstName.value = null;
    lastName.value = null;
    phone.value = null;
    email.value = null;
}

const hasCompany = computed({
    get: () => !!props.customer.company,
    set: (enabled: boolean) => {
        if (enabled === !!props.customer.company) {
            return;
        }
        if (enabled) {
            addPatch({
                company: Company.create({}),
            });
        }
        else {
            addPatch({
                company: null,
            });
        }
    },
});

const firstName = computed({
    get: () => props.customer.firstName ?? '',
    set: (firstName: string | null) => {
        addPatch({
            firstName: firstName || null,
        });
    },
});

const lastName = computed({
    get: () => props.customer.lastName ?? '',
    set: (lastName: string | null) => {
        addPatch({
            lastName: lastName || null,
        });
    },
});

const email = computed({
    get: () => props.customer.email ?? '',
    set: (email: string | null) => {
        addPatch({
            email: email || null,
        });
    },
});

const phone = computed({
    get: () => props.customer.phone ?? '',
    set: (phone: string | null) => {
        addPatch({
            phone: phone || null,
        });
    },
});

</script>
