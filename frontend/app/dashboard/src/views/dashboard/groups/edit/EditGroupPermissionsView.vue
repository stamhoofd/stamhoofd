<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasChanges" @save="save">
        <h1>
            {{ title }}
        </h1>
        
        <p>Kies welke beheerdersrollen toegang hebben tot deze inschrijvingsgroep (hoofdbeheerders kunnen beheerdersrollen wijzigen via Instellingen → Beheerders)</p>
        <STErrorsDefault :error-box="errorBox" />

        <STList v-if="roles.length > 0">
            <STListItem>
                <template #left>
                    <Checkbox :modelValue="true" :disabled="true" />
                </template>
                Hoofdbeheerders
            </STListItem>

            <GroupPermissionRow v-for="role in roles" :key="role.id" :role="role" :show-role="true" :organization="patchedOrganization" :group="patchedGroup" @patch="addOrganizationPatch" />
        </STList>

        <p v-else class="info-box">
            Er zijn nog geen beheerdersrollen aangemaakt in deze vereniging. Enkel hoofdbeheerders kunnen deze groep voorlopig bekijken en bewerken. Je kan beheerdersrollen aanmaken bij Instellingen → Beheerders.
        </p>
    </SaveView>
</template>

<script lang="ts">
import { Checkbox, SaveView, STErrorsDefault, STInputBox, STList, STListItem } from "@stamhoofd/components";
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";

import GroupPermissionRow from "../../admins/GroupPermissionRow.vue";
import EditGroupMixin from './EditGroupMixin';

@Component({
    components: {
        SaveView,
        STInputBox,
        STErrorsDefault,
        STList,
        GroupPermissionRow,
        STListItem,
        Checkbox
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