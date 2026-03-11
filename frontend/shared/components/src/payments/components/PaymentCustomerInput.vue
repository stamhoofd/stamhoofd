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
                    <h3>{{ $t('2feeeb44-07b2-460e-a664-a08e1713408e') }}</h3>
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
                <STInputBox error-fields="firstName,lastName" :error-box="errorBox" :title="$t(`2a10aac1-e404-4de4-865d-75593b2b5e8d`)">
                    <div class="input-group">
                        <div>
                            <input v-model="firstName" class="input" type="text" autocomplete="given-name" :placeholder="$t(`603606c2-95ca-4967-814c-53ec3297bf33`)">
                        </div>
                        <div>
                            <input v-model="lastName" class="input" type="text" autocomplete="family-name" :placeholder="$t(`033780e9-417d-4f0a-9aba-7ddfdf655d22`)">
                        </div>
                    </div>

                    <template #right>
                        <button v-tooltip="$t('61f5543d-e014-449f-bad3-a7a2f0e59dab')" type="button" class="button icon trash small" @click="removeContact" />
                    </template>
                </STInputBox>

                <EmailInput v-model="email" :validator="validator" autocomplete="email" :required="false" :title="$t(`237d0720-13f0-4029-8bf2-4de7e0a9a358`)" :placeholder="$t(`07cf8cd9-433f-42e6-8b3a-a5dba83ecc8f`)" />
                <PhoneInput v-model="phone" :validator="validator" autocomplete="phone" :required="false" :title="$t(`3174ba16-f035-4afd-a69f-74865e64ef34`)" :placeholder="$t(`07cf8cd9-433f-42e6-8b3a-a5dba83ecc8f`)" />
            </template>
            <button v-else type="button" class="button text" @click="enableContact">
                <span class="icon add" />
                <span>{{ $t('2a10aac1-e404-4de4-865d-75593b2b5e8d') }}</span>
            </button>
        </template>
        <template v-else>
            <STInputBox error-fields="firstName,lastName" :error-box="errorBox" :title="$t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`)">
                <div class="input-group">
                    <div>
                        <input v-model="firstName" class="input" type="text" autocomplete="given-name" :placeholder="$t(`603606c2-95ca-4967-814c-53ec3297bf33`)">
                    </div>
                    <div>
                        <input v-model="lastName" class="input" type="text" autocomplete="family-name" :placeholder="$t(`033780e9-417d-4f0a-9aba-7ddfdf655d22`)">
                    </div>
                </div>
            </STInputBox>

            <EmailInput v-model="email" :validator="validator" autocomplete="email" :required="false" :title="$t(`237d0720-13f0-4029-8bf2-4de7e0a9a358`)" :placeholder="$t(`07cf8cd9-433f-42e6-8b3a-a5dba83ecc8f`)" />
            <PhoneInput v-model="phone" :validator="validator" autocomplete="phone" :required="false" :title="$t(`3174ba16-f035-4afd-a69f-74865e64ef34`)" :placeholder="$t(`07cf8cd9-433f-42e6-8b3a-a5dba83ecc8f`)" />
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
