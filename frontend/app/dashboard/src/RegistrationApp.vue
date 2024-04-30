<template>
    <div id="registration">
        <ComponentWithPropertiesInstance :component="root" />
    </div>
</template>

<script lang="ts">
import { Decoder } from "@simonbackx/simple-encoding";
import { ComponentWithProperties, ComponentWithPropertiesInstance } from "@simonbackx/vue-app-navigation";
import { PromiseView } from '@stamhoofd/components';
import { I18nController } from "@stamhoofd/frontend-i18n";
import { NetworkManager, Session, SessionManager, UrlHelper } from "@stamhoofd/networking";
import { Country, Organization } from "@stamhoofd/structures";
import { Component, Vue } from "@simonbackx/vue-app-navigation/classes";

//import { getRootView } from "@stamhoofd/registration/src/getRootView";
import OrganizationSelectionView from "./views/login/OrganizationSelectionView.vue";

@Component({
    components: {
        ComponentWithPropertiesInstance
    },
})
export default class RegistrationApp extends Vue {
    root = new ComponentWithProperties(PromiseView, {
        promise: async () => {
            UrlHelper.fixedPrefix = "leden";
            const parts = UrlHelper.shared.getParts();

            if (parts[0]) {
                const uri = parts[0];

                // Load organization
                // todo: use cache
                try {
                    const response = await NetworkManager.server.request({
                        method: "GET",
                        path: "/organization-from-uri",
                        query: {
                            uri
                        },
                        decoder: Organization as Decoder<Organization>
                    })
                    const organization = response.data

                    const session = new Session(organization.id)
                    session.setOrganization(organization)
                    await session.loadFromStorage()
                    await SessionManager.prepareSessionForUsage(session, false);

                    UrlHelper.fixedPrefix = "leden/" + organization.uri;
                    await I18nController.loadDefault(session, "registration", Country.Belgium, "nl", session.organization?.address?.country)

                    return null; //return getRootView(session)
                } catch (e) {
                    console.error('Failed to load organization from uri', uri);
                }
            }
            await I18nController.loadDefault(null, "registration", Country.Belgium, "nl")

            // Go to organization selection
            return new ComponentWithProperties(OrganizationSelectionView);
        }
    })
}
</script>