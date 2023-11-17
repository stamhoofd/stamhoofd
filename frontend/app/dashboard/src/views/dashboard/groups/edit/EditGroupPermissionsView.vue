<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasChanges" @save="save">
        <h1>
            {{ title }}
        </h1>
        
        <p>Kies welke functies toegang hebben tot deze inschrijvingsgroep. Vraag aan de hoofdbeheerders om nieuwe functies aan te maken indien nodig. Hoofdbeheerders hebben altijd toegang tot alle groepen. Enkel beheerders met 'volledige toegang' kunnen instellingen wijzigen van de inschrijvingsgroep.</p>
        <STErrorsDefault :error-box="errorBox" />

        <STList v-if="roles.length > 0">
            <GroupPermissionRow v-for="role in roles" :key="role.id" :role="role" :show-role="true" :organization="patchedOrganization" :group="patchedGroup" @patch="addOrganizationPatch" />
        </STList>

        <p v-else class="warning-box">
            Er zijn nog geen functies aangemaakt in deze vereniging. Enkel hoofdbeheerders kunnen deze groep voorlopig bekijken en bewerken. Je kan functies aanmaken bij instellingen > beheerders.
        </p>
    </SaveView>
</template>

<script lang="ts">
import { SaveView, STErrorsDefault, STInputBox, STList } from "@stamhoofd/components";
import { Component, Mixins } from "vue-property-decorator";

import GroupPermissionRow from "../../admins/GroupPermissionRow.vue";
import EditGroupMixin from './EditGroupMixin';

@Component({
    components: {
        SaveView,
        STInputBox,
        STErrorsDefault,
        STList,
        GroupPermissionRow,
    },
})
export default class EditGroupPermissionsView extends Mixins(EditGroupMixin) {
    get title() {
        return 'Toegangsbeheer'
    }

    get roles() {
        return this.patchedOrganization.privateMeta?.roles ?? []
    }
}
</script>