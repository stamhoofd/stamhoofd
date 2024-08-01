<template>
    <div class="st-view">
        <STNavigationBar :title="title" />
        <main>
            <h1>{{ title }}</h1>
            
            <p>
                Je ontvangt een extra bevestiging via e-mail. Als er in de toekomst gegevens wijzigen kan je die vanaf nu beheren via het ledenportaal.
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
import { STToolbar } from '@stamhoofd/components';
import { RegisterCheckout, RegistrationWithMember } from '@stamhoofd/structures';
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

const title = computed(() => {
    let t = "Hoera! "
    const names = Formatter.uniqueArray(props.registrations.filter(r => !r.waitingList).map(r => r.member.details?.firstName ?? "?"))

    if (names.length > 0) {
        if (names.length > 2) {
            t += names.slice(0, names.length - 1).join(', ')+" en "+names[names.length - 1] +" zijn ingeschreven"
        } else if (names.length > 1) {
            t += names.join(' en ')+" zijn ingeschreven"
        } else {
            t += names.join('')+" is ingeschreven"
        }
    }

    const waitingListNames = Formatter.uniqueArray(props.registrations.filter(r => r.waitingList).map(r => r.member.details?.firstName ?? "?"))

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

