<template>
    <SaveView :title="viewTitle" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>{{ viewTitle }}</h1>
        <p>Kies welke beheerdersgroepen toegang hebben tot deze webshop. Vraag aan de hoofdbeheerders om nieuwe beheerdersgroepen aan te maken indien nodig. Hoofdbeheerders hebben altijd toegang tot alle webshops. Enkel beheerders met 'volledige toegang' kunnen instellingen wijzigen van de webshop.</p>

        <p v-if="roles.length == 0" class="error-box">
            Je hebt nog geen beheerdersgroepen aangemaakt. Maak eerst beheerders aan en deel ze op in beheerdersgroepen via de instellingen (enkel voor hoofdbeheerders). Daarna kan je de toegang hier verdelen.
        </p>

        <STErrorsDefault :error-box="errorBox" />

        <STList>
            <WebshopRolePermissionRow v-for="role in roles" :key="role.id" :role="role" :organization="organization" :webshop="webshop" @patch="addPatch" />
        </STList>
    </SaveView>
</template>

<script lang="ts">
import { SaveView, STErrorsDefault, STList } from "@stamhoofd/components";
import { SessionManager } from "@stamhoofd/networking";
import { Component, Mixins } from "vue-property-decorator";

import WebshopRolePermissionRow from '../../admins/WebshopRolePermissionRow.vue';
import EditWebshopMixin from './EditWebshopMixin';

@Component({
    components: {
        STList,
        STErrorsDefault,
        WebshopRolePermissionRow,
        SaveView
    }
})
export default class EditWebshopPermissionsView extends Mixins(EditWebshopMixin) {
    get viewTitle() {
        return "Toegangsbeheer"
    }

    get organization() {
        return SessionManager.currentSession!.organization!
    }

    get roles() {
        return this.organization.privateMeta?.roles ?? []
    }
}
</script>
