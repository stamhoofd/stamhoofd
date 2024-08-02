<template>
    <div class="st-view">
        <STNavigationBar :title="title" />
        <main>
            <h1>{{ title }}</h1>

            <template v-if="!checkout.isAdminFromSameOrganization">
                <p v-if="names.length > 0">
                    Je ontvangt een extra bevestiging via e-mail. Als er in de toekomst gegevens wijzigen kan je die vanaf nu beheren via het ledenportaal.
                </p>

                <p v-else-if="waitingListNames.length > 0">
                    We houden je op de hoogte van jouw status op de wachtlijst.
                </p>

                <p v-else>
                    We houden je op de hoogte.
                </p>
            </template>
            <p v-else>
                Er werden mogelijks automatische e-mails uitgestuurd als die ingesteld stonden.
            </p>
        </main>

        <STToolbar>
            <template #right>
                <button class="button primary" type="button" @click="dismiss({ force: true })">
                    <span>Sluiten</span>
                    <span class="icon arrow-right" />
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts" setup>
import { useDismiss } from '@simonbackx/vue-app-navigation';
import { STToolbar, useAppContext } from '@stamhoofd/components';
import { GroupType, RegisterCheckout, RegistrationWithMember } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, onMounted } from 'vue';

const props = defineProps<{
    checkout: RegisterCheckout,
    registrations: RegistrationWithMember[]
}>();
const dismiss = useDismiss()

onMounted(() => {
    props.checkout.clear()
})

const app = useAppContext()
const names = Formatter.uniqueArray(props.registrations.filter(r => r.group.type !== GroupType.WaitingList).map(r => r.member.details?.firstName ?? "?"))
const waitingListNames = Formatter.uniqueArray(props.registrations.filter(r => r.group.type === GroupType.WaitingList).map(r => r.member.details?.firstName ?? "?"))

const title = computed(() => {
    let t = "Hoera! "

    if (names.length > 0) {
        if (names.length > 2) {
            t += names.slice(0, names.length - 1).join(', ')+" en "+names[names.length - 1] +" zijn ingeschreven"
        } else if (names.length > 1) {
            t += names.join(' en ')+" zijn ingeschreven"
        } else {
            t += names.join('')+" is ingeschreven"
        }
    }

    if (waitingListNames.length > 0) {
        if (names.length > 0) {
            t += " en "
        }

        if (waitingListNames.length > 2) {
            t += waitingListNames.slice(0, waitingListNames.length - 1).join(', ')+" en "+waitingListNames[waitingListNames.length - 1] +" staan op de wachtlijst"
        } else if (waitingListNames.length > 1) {
            t += waitingListNames.join(' en ')+" staan op de wachtlijst"
        } else {
            t += waitingListNames.join('')+" staat op de wachtlijst"
        }
    }
    return t
});

</script>

