<template>
    <span>
        <span v-if="group.closed && !group.notYetOpen" class="style-tag error">Gesloten</span>
        <template v-else>
            <span v-if="group.notYetOpen" class="style-tag error">Nog niet geopend</span>
            <template v-if="group.settings.registeredMembers !== null && group.settings.maxMembers !== null">
                <span v-if="group.settings.availableMembers > 0" class="style-tag warn">
                    Nog {{ group.settings.availableMembers }} {{ group.settings.availableMembers != 1 ? 'plaatsen' : 'plaats' }}
                </span>
                <span v-else-if="waitingListIfFull" class="style-tag error">
                    Wachtlijst (volzet)
                </span>
                <span v-else class="style-tag error">
                    Volzet
                </span>
                <span v-if="preRegistrations && group.settings.availableMembers > 0" class="style-tag warn">Voorinschrijvingen</span>
            </template>
            <span v-else-if="preRegistrations" class="style-tag warn">Voorinschrijvingen</span>
            <span v-else-if="allWaitingList" class="style-tag error">Wachtlijst</span>
        </template>
    </span>
</template>

<script lang="ts">
import { Group, WaitingListType } from '@stamhoofd/structures';
import { Component, Prop,Vue } from "vue-property-decorator";

@Component({
    components: {},
})
export default class GroupTag extends Vue {
    @Prop({ required: true })
    group: Group
    
    get preRegistrations() {
        return this.group.activePreRegistrationDate !== null
    }

    get waitingListIfFull() {
        return this.group.settings.waitingListIfFull
    }

    get allWaitingList() {
        return this.group.settings.waitingListType === WaitingListType.All
    }

    get newWaitingList() {
        return this.group.settings.waitingListType === WaitingListType.ExistingMembersFirst
    }
}
</script>