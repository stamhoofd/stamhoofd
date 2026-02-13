import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { EmailInformation } from '@stamhoofd/structures';
import { computed, ComputedRef } from 'vue';
import { useAppContext } from '../../context';
import { getInvalidEmailDescription } from '../../helpers';
import { useAuth, useEmailInformation, useFeatureFlag } from '../../hooks';
import EmailInformationView from '../EmailInformationView.vue';

function usePresentEmailInformation() {
    const present = usePresent();

    return {
        present: async (emailInformation: EmailInformation) => {
            const component = new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(EmailInformationView, {
                    emailInformation,
                }),
            });

            await present({
                components: [component],
                modalDisplayStyle: 'popup',
            });
        },
    };
}

function checkCanReadEmailInformation() {
    const app = useAppContext();

    return app !== 'registration' && useFeatureFlag()('STA-673');
}

export function useManageMemberEmail(email: string | ComputedRef<string | null | undefined>) {
    const canReadEmailInformation = checkCanReadEmailInformation();
    const emailInformation = canReadEmailInformation ? useEmailInformation(email) : computed(() => null);

    const emailWarningMessage = computed(() => {
        if (emailInformation.value) {
            return getInvalidEmailDescription(emailInformation.value);
        }
        return null;
    });

    const presentEmailInformation = usePresentEmailInformation();
    const canManageEmailAddress = computed(() => auth.hasFullAccess() || auth.hasPlatformFullAccess());

    const auth = useAuth();

    return {
        emailInformation,
        emailWarningMessage,
        canReadEmailInformation,
        canManageEmailAddress,
        presentEmailInformation: async () => {
            if (emailInformation.value && canManageEmailAddress.value) {
                presentEmailInformation.present(emailInformation.value).catch(console.error);
            }
        },
    };
}
