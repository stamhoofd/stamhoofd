import { computed, ref, Ref, watchEffect } from "vue";
import { useOrganization } from "../../hooks";
import { SessionContext, useRequestOwner } from "@stamhoofd/networking";
import { Organization } from "@stamhoofd/structures";
import { Decoder } from "@simonbackx/simple-encoding";
import { ErrorBox } from "../../errors/ErrorBox";
import { NavigationActions } from "../../types/NavigationActions";
import { ComponentWithProperties, usePresent } from "@simonbackx/vue-app-navigation";
import { SearchOrganizationView } from "../../members";

export function useExternalOrganization(organizationId: Ref<string | null>) {
    const organization = useOrganization()
    const loadedOrganization = ref(null) as Ref<Organization | null>;
    const errorBox = ref(null) as Ref<ErrorBox | null>;
    const present = usePresent()

    let loadingOrganizationId: string | null; // not reactive
    let loadingCount = 0;

    const owner = useRequestOwner()

    const externalOrganization = computed(() => {
        if (!organizationId.value) {
            return null;
        }

        if (organizationId.value === organization.value?.id) {
            return organization.value;
        }

        return loadedOrganization.value;
    })

    function check() {
        if (organizationId.value && (!externalOrganization.value || externalOrganization.value.id !== organizationId.value)) {
            // Start loading
            loadOrganization().catch(console.error)
        }
    }

    watchEffect(() => {
        check()
    });

    async function loadOrganization() {
        const id = organizationId.value;
        if (loadingOrganizationId === id) {
            // Already loading
            return;
        }

        loadingOrganizationId = id;
        loadingCount++;
        const currentCount = loadingCount;

        try {
            errorBox.value = null
            const response = await SessionContext.serverForOrganization(organizationId.value).request({
                method: "GET",
                path: "/organization",
                decoder: Organization as Decoder<Organization>,
                shouldRetry: true,
                owner
            })

            if (loadingCount !== currentCount) {
                // Ignore
                return;
            }

            loadingOrganizationId = null;

            if (response.data.id === organizationId.value) {
                loadedOrganization.value = response.data;
            }
        } catch (e) {
            if (loadingCount !== currentCount) {
                // Ignore
                return;
            }

            loadingOrganizationId = null;
            errorBox.value = new ErrorBox(e);
        }
    }
        
    return {
        loading: computed(() => externalOrganization.value === null && !!organizationId.value),
        errorBox,
        externalOrganization,
        choose: async function chooseOrganizer(title: string) {
            await present({
                components: [
                    new ComponentWithProperties(SearchOrganizationView, {
                        title,
                        selectOrganization: async (organization: Organization, {dismiss}: NavigationActions) => {
                            await dismiss({force: true});
                            loadedOrganization.value = organization;
                            organizationId.value = organization.id;
                        }
                    })
                ],
                modalDisplayStyle: "popup"
            })
        }
    }
}   
