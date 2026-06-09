<template>
    <div class="st-view">
        <STNavigationBar
            :title="$t('Lijken op elkaar')"
            :dismiss="canDismiss"
            :pop="canPop"
        />

        <main>
            <h1>
                {{
                    $t(
                        "Vink de rijen uit als het om verschillende personen gaat",
                    )
                }}
            </h1>
            <p>
                {{
                    $t(
                        "We zijn niet helemaal zeker dat deze leden uit Stamhoofd in de groepsadministratie op dezelfde persoon duiden. Kan je dit manueel verifiëren?",
                    )
                }}
            </p>

            <STList>
                <STListItem
                    v-for="match in matches"
                    :key="match.member.id"
                    element-name="label"
                    :selectable="true"
                >
                    <template #left>
                        <div>
                            <h2 class="style-title-list">
                                {{ match.member.details.name }}
                            </h2>
                            <p class="style-description-small">
                                {{
                                    match.member.details.birthDayFormatted ||
                                    "/"
                                }}
                            </p>
                        </div>
                    </template>

                    <div>
                        <h2 class="style-title-list">
                            {{ sgvName(match.sgv) }}
                        </h2>
                        <p class="style-description-small">
                            {{ sgvBirthDay(match.sgv) }}
                        </p>
                    </div>

                    <template #right>
                        <Checkbox v-model="match.verify" />
                    </template>
                </STListItem>
            </STList>
        </main>

        <STToolbar>
            <template #right>
                <button class="button secundary" type="button" @click="cancel">
                    <span>{{ $t("Annuleren") }}</span>
                </button>
                <button class="button primary" type="button" @click="goNext">
                    {{ $t("Verder") }}
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script setup lang="ts">
import {
    useCanDismiss,
    useCanPop,
    useDismiss,
} from "@simonbackx/vue-app-navigation";
import Checkbox from "@stamhoofd/components/inputs/Checkbox.vue";
import STList from "@stamhoofd/components/layout/STList.vue";
import STListItem from "@stamhoofd/components/layout/STListItem.vue";
import STNavigationBar from "@stamhoofd/components/navigation/STNavigationBar.vue";
import STToolbar from "@stamhoofd/components/navigation/STToolbar.vue";
import { Formatter } from "@stamhoofd/utility";
import type { SGVMemberMatchVerify } from "../../../classes/SGVGroupAdministration";
import { onBeforeUnmount, ref } from "vue";

const props = defineProps<{
    matches: SGVMemberMatchVerify[];
    onVerified: (verified: SGVMemberMatchVerify[]) => void;
    onCancel: () => void;
}>();

const didVerify = ref(false);
const dismiss = useDismiss();
const canDismiss = useCanDismiss();
const canPop = useCanPop();

function cancel() {
    dismiss({ force: true }).catch(console.error);
}

function goNext() {
    if (didVerify.value) return;
    didVerify.value = true;
    dismiss({ force: true })
        .then(() => props.onVerified(props.matches))
        .catch(console.error);
}

function sgvName(sgv: SGVMemberMatchVerify["sgv"]) {
    return "firstName" in sgv
        ? `${sgv.firstName} ${sgv.lastName}`
        : `${sgv.voornaam} ${sgv.achternaam}`;
}

function sgvBirthDay(sgv: SGVMemberMatchVerify["sgv"]) {
    if ("birthDay" in sgv) return Formatter.date(sgv.birthDay, true);
    return sgv.geboortedatum;
}

onBeforeUnmount(() => {
    if (!didVerify.value) props.onCancel();
});
</script>
