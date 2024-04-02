<template>
    <SaveView :title="viewTitle" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>{{ viewTitle }}</h1>
        <p>Kies welke functies toegang hebben tot deze webshop. Vraag aan de hoofdbeheerders om nieuwe functies aan te maken indien nodig. Hoofdbeheerders hebben altijd toegang tot alle webshops. Enkel beheerders met 'volledige toegang' kunnen instellingen wijzigen van de webshop.</p>

        <p v-if="roles.length == 0" class="error-box">
            Je hebt nog geen functies aangemaakt. Maak eerst beheerders aan en deel ze op in functies via de instellingen (enkel voor hoofdbeheerders). Daarna kan je de toegang hier verdelen.
        </p>

        <STErrorsDefault :error-box="errorBox" />

        <STList>
            <WebshopPermissionRow v-for="role in roles" :key="role.id" type="role" :role="role" :organization="organization" :webshop="webshop" @patch="addPatch" />
        </STList>
    </SaveView>
</template>

<script lang="ts">
import { SaveView, STErrorsDefault, STList } from "@stamhoofd/components";
import { SessionManager, UrlHelper } from "@stamhoofd/networking";
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins } from "vue-property-decorator";

import WebshopPermissionRow from '../../admins/WebshopPermissionRow.vue';
import EditWebshopMixin from './EditWebshopMixin';

@Component({
    components: {
        STList,
        STErrorsDefault,
        WebshopPermissionRow,
        SaveView
    }
})
export default class EditWebshopPermissionsView extends Mixins(EditWebshopMixin) {
    mounted() {
        UrlHelper.setUrl("/webshops/" + Formatter.slug(this.webshop.meta.name) + "/settings/permissions")
    }

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
