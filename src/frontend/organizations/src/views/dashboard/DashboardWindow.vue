<template>
    <Window ref="window" :root="root" />
</template>

<script lang="ts">
import { STErrors } from '@stamhoofd-common/errors';
import { Session } from '@stamhoofd-frontend/users';
import { ComponentWithProperties } from "@stamhoofd/shared/classes/ComponentWithProperties";
import NavigationController from '@stamhoofd/shared/components/layout/NavigationController.vue';
import SplitViewController from "@stamhoofd/shared/components/layout/SplitViewController.vue";
import { Component, Vue } from "vue-property-decorator";

import ConfirmEmailView from '../create-organization/ConfirmEmailView.vue';
import Window from "../Window.vue";
import Menu from "./Menu.vue";
@Component({
    components: {
        Window
    },
})
export default class DashboardWindow extends Vue {
    public root = new ComponentWithProperties(SplitViewController, {
        root: new ComponentWithProperties(Menu, {}),
    });

    mounted() {
        Session.restoreFromKeyChain().then((session) => {
            if (session) {
                // Yay! we have a token
                console.log("Found session in keychain", session)
                session.setDefault()

                session.token.refresh(session.server).then(() => {
                    // We have a token, yay!
                }).catch(e => {
                    if (e instanceof STErrors) {
                        if (e.errors[0].code == "user_not_verified") {
                            (this.$refs.window as any).$refs.stack.present(new ComponentWithProperties(NavigationController, { root: new ComponentWithProperties(ConfirmEmailView) }));
                        } else {
                            // Not valid: sign out!
                            this.signOut();
                        }
                    } else {
                        // Not valid: sign out!
                        this.signOut();
                    }
                })
            }
        }).catch(e => {
            console.error(e);
            // todo: kill and logout
            this.signOut();
        });
    }

    signOut() {
        if (!process.env.IS_ELECTRON) {
            // Store in different place
            console.error("Sign out without electron not yet implemented! We need a redirect or reload here!");
            return;
        }

        (async () => {
            const { ipcRenderer } = await import('electron')
            ipcRenderer.send('logout');
        })().catch(e => console.error(e))


    }
}
</script>