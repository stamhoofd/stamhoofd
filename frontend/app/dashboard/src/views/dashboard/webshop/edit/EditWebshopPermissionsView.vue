<template>
    <SaveView :title="viewTitle" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>{{ viewTitle }}</h1>
        <p>Kies welke beheerdersrollen toegang hebben tot deze webshop (hoofdbeheerders kunnen beheerdersrollen wijzigen via Instellingen → Beheerders)</p>

        <p v-if="roles.length == 0" class="info-box">
            Je hebt nog geen beheerdersrollen aangemaakt. Maak eerst beheerders aan en deel ze op in beheerdersrollen via de instellingen (enkel voor hoofdbeheerders). Daarna kan je de toegang hier verdelen.
        </p>

        <STErrorsDefault :error-box="errorBox" />

        <STList>
            <STListItem>
                <template #left>
                    <Checkbox :checked="true" :disabled="true" />
                </template>
                Hoofdbeheerders
            </STListItem>
            <WebshopPermissionRow v-for="role in roles" :key="role.id" type="role" :role="role" :organization="organization" :webshop="webshop" @patch="addPatch" />
        </STList>
    </SaveView>
</template>

<script lang="ts">
import { Checkbox, SaveView, STErrorsDefault, STList, STListItem } from "@stamhoofd/components";
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
        SaveView,
        STListItem,
        Checkbox
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
        return this.$context.organization!
    }

    get roles() {
        return this.organization.privateMeta?.roles ?? []
    }
}
</script>
