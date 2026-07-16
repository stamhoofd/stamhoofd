import { defineRoute, useNavigate } from '@simonbackx/vue-app-navigation';
import type { Ref } from 'vue';

export function useForgotPassword({ email }: { email: Ref<string> }) {
    const navigate = useNavigate();
    const Route = defineRoute(
        {
            url: 'wachtwoord-vergeten',
            component: async () => (await import('./ForgotPasswordView.vue')).default,
            defaultProperties() {
                return {
                    initialEmail: email.value,
                };
            },
        },
    );

    async function gotoPasswordForgot() {
        await navigate(Route);
    }

    return {
        gotoPasswordForgot,
        Route,
    };
}
