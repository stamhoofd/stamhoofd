<template>
    <div class="st-view">
        <STNavigationBar
            :title="$t('Schrappen')"
            :dismiss="canDismiss"
            :pop="canPop"
        />

        <main>
            <h1>
                {{
                    $t("Wil je deze leden schrappen in de groepsadministratie?")
                }}
            </h1>
            <p>
                {{
                    $t(
                        "Er staan leden in de groepsadministratie die nog niet in Stamhoofd staan. Je kan deze schrappen of behouden.",
                    )
                }}
            </p>
            <p class="info-box">
                {{
                    $t(
                        "Gestopte leiding of vrijwilligers moet je zelf schrappen. Stamhoofd doet dit niet automatisch.",
                    )
                }}
            </p>

            <STList>
                <STListItem v-for="member in members" :key="member.id">
                    <h2 class="style-title-list">
                        {{ member.firstName }} {{ member.lastName }}
                    </h2>
                    <p class="style-description-small">
                        {{ Formatter.date(member.birthDay, true) }}
                    </p>
                </STListItem>
            </STList>
        </main>

        <STToolbar>
            <template #right>
                <button
                    class="button destructive"
                    type="button"
                    @click="doDelete"
                >
                    <span class="icon trash" /><span>{{
                        $t("Schrappen")
                    }}</span>
                </button>
                <button class="button primary" type="button" @click="doNothing">
                    {{ $t("Behouden") }}
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
import STList from "@stamhoofd/components/layout/STList.vue";
import STListItem from "@stamhoofd/components/layout/STListItem.vue";
import STNavigationBar from "@stamhoofd/components/navigation/STNavigationBar.vue";
import STToolbar from "@stamhoofd/components/navigation/STToolbar.vue";
import { Formatter } from "@stamhoofd/utility";
import {
    SGVOldMemberAction,
    type SGVMemberListItem,
} from "../../../classes/SGVGroupAdministration";
import { onBeforeUnmount, ref } from "vue";

const props = defineProps<{
    members: SGVMemberListItem[];
    setAction: (action: SGVOldMemberAction) => void;
    onCancel: () => void;
}>();

const didSetAction = ref(false);
const dismiss = useDismiss();
const canDismiss = useCanDismiss();
const canPop = useCanPop();

function setAction(action: SGVOldMemberAction) {
    if (didSetAction.value) return;
    didSetAction.value = true;
    dismiss({ force: true })
        .then(() => props.setAction(action))
        .catch(console.error);
}

function doDelete() {
    setAction(SGVOldMemberAction.Delete);
}
function doNothing() {
    setAction(SGVOldMemberAction.Nothing);
}

onBeforeUnmount(() => {
    if (!didSetAction.value) props.onCancel();
});
</script>
