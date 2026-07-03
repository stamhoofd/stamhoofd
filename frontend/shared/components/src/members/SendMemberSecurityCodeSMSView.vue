<template>
    <SaveView :title="$t('Stuur de code via SMS')" :loading="loading" :save-text="$t('Verstuur')" @save="submit">
        <h1>{{ $t('Stuur de code via SMS') }}</h1>
        <p>{{ $t('Vul het gsm-nummer in waarop je de code van {member} wil ontvangen. We sturen de code enkel als we dit nummer kennen van dit lid.', { member: memberName }) }}</p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <PhoneInput v-if="!sendToAny" v-model="phone" :title="$t('Telefoonnummer')" :placeholder="$t('Vul jouw GSM-nummer hier in')" :validator="errors.validator" :required="true" :nullable="false" />

        <STList>
            <CheckboxListItem v-model="sendToAny" :label="$t('Stuur naar gelijk welk GSM-nummer we kennen van {member}', { member: memberName })" />
        </STList>
    </SaveView>
</template>

<script setup lang="ts">
import { usePop } from '@simonbackx/vue-app-navigation';
import { ref } from 'vue';
import { ErrorBox } from '../errors/ErrorBox';
import { useErrors } from '../errors/useErrors';
import CheckboxListItem from '../inputs/CheckboxListItem.vue';
import PhoneInput from '../inputs/PhoneInput.vue';
import { CenteredMessage } from '#overlays/CenteredMessage.ts';

const props = defineProps<{
    memberName: string;
    // Sends the code. When phone is null we send to any known number, otherwise only if it matches a known
    // number for the member. Should throw on failure and show a success toast on success.
    sendHandler: (phone: string | null) => Promise<void>;
}>();

const pop = usePop();
const errors = useErrors();
const loading = ref(false);
const phone = ref<string | null>(null);

// When checked, the user does not fill in a number and we send to any number we know for the member.
const sendToAny = ref(false);

async function submit() {
    if (loading.value) {
        return;
    }
    loading.value = true;

    try {
        if (!sendToAny.value && !await errors.validator.validate()) {
            loading.value = false;
            return;
        }

        await props.sendHandler(sendToAny.value ? null : phone.value);
        await pop({ force: true });
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    }

    loading.value = false;
}

const shouldNavigateAway = async () => {
    return await CenteredMessage.confirm($t(`Ben je zeker dat je wilt sluiten zonder een SMS te sturen?`), $t(`Niet versturen`));
};

defineExpose({
    shouldNavigateAway,
});

</script>
