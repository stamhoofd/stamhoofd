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
                    <h3>{{ $t('%1KW') }}</h3>
                </label>

                <label class="illustration-radio-box">
                    <div>
                        <Radio v-model="hasCompany" :value="false" />
                    </div>
                    <figure>
                        <img src="~@stamhoofd/assets/images/illustrations/user.svg">
                    </figure>
                    <h3>{{ $t('%1J8') }}</h3>
                </label>
            </div>
        </STInputBox>

        <CompanyInputBox v-if="customer.company" :validator="validator" :company="customer.company" @patch:company="addPatch({ company: $event })" />
        <template v-else>
            <STInputBox error-fields="firstName,lastName" :error-box="errorBox" :title="$t(`%1Os`)">
                <div class="input-group">
                    <div>
                        <input v-model="firstName" class="input" type="text" autocomplete="given-name" :placeholder="$t(`%1MT`)">
                    </div>
                    <div>
                        <input v-model="lastName" class="input" type="text" autocomplete="family-name" :placeholder="$t(`%1MU`)">
                    </div>
                </div>
            </STInputBox>

            <EmailInput v-model="email" :validator="validator" autocomplete="email" :required="false" :title="$t(`%1FK`)" :placeholder="$t(`%14p`)" />
            <PhoneInput v-model="phone" :validator="validator" autocomplete="phone" :required="false" :title="$t(`%18Z`)" :placeholder="$t(`%14p`)" />
        </template>
    </div>
</template>

<script lang="ts" setup>
import CompanyInputBox from '@stamhoofd/components/organizations/components/CompanyInputBox.vue';
import EmailInput from '@stamhoofd/components/inputs/EmailInput.vue';
import type { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import PhoneInput from '@stamhoofd/components/inputs/PhoneInput.vue';
import RadioListItem from '@stamhoofd/components/inputs/RadioListItem.vue';
import STInputBox from '@stamhoofd/components/inputs/STInputBox.vue';
import { useEmitPatch } from '@stamhoofd/components/hooks/useEmitPatch.ts';
import type { Validator } from '@stamhoofd/components/errors/Validator.ts';
import type { PaymentCustomer } from '@stamhoofd/structures';
import { Company } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = withDefaults(defineProps<{
    customer: PaymentCustomer;
    validator: Validator;
    errorBox?: ErrorBox | null;
}>(), {
    errorBox: null,
});

const emit = defineEmits(['patch:customer']);
const { addPatch } = useEmitPatch<PaymentCustomer>(props, emit, 'customer');

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
