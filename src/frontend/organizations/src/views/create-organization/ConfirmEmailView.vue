<template>
    <div id="confirm-email-view" class="st-view">
        <STNavigationBar title="Bevestig je e-mailadres">
            <template #left>
                <button class="button icon gray arrow-left" @click="pop">
                    Terug
                </button>
            </template>
        </STNavigationBar>
        <STNavigationTitle>
            Bevestig je e-mailadres
        </STNavigationTitle>

        <main>
            <p>Je hebt een e-mail ontvangen waarmee je je e-mailadres kan bevestigen.</p>
        </main>

        <STToolbar>
            <template #right>
                <button class="button secundary">
                    Niet ontvangen?
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { STErrors } from '@stamhoofd-common/errors';
import { Session, SessionManager } from '@stamhoofd-frontend/users';
import { NavigationMixin } from "@stamhoofd/shared/classes/NavigationMixin";
import STNavigationBar from "@stamhoofd/shared/components/navigation/STNavigationBar.vue"
import STNavigationTitle from "@stamhoofd/shared/components/navigation/STNavigationTitle.vue"
import STToolbar from "@stamhoofd/shared/components/navigation/STToolbar.vue"
import { Component, Mixins } from "vue-property-decorator";


@Component({
    components: {
        STToolbar,
        STNavigationBar,
        STNavigationTitle
    }
})
export default class ConfirmEmailView extends Mixins(NavigationMixin) {
    mounted() {
        this.doCheck()
    }

    doCheck() {
        SessionManager.getLastSession().then(session => {
            if (!session) {
                throw new Error("Expected session")
            }

            console.log("do check again");
            
            // Try to refresh token
            session.token.refresh(session.server).then(() => {
                // todo: do something with the token
                console.log("Yay! Refreshed the token!")
                this.pop()
            }).catch(e => {
                console.error(e)
                if (e instanceof STErrors) {
                    if (e.errors[0].code == "user_not_verified") {
                        console.log("still same thing")

                        setTimeout(this.doCheck, 5000);
                    }
                }
            })
        }).catch(e => {
            console.error(e)
        })
        
    }
}
</script>

<style lang="scss">
@use '@stamhoofd/scss/base/text-styles.scss';

#confirm-email-view {
    > main {
        p {
            @extend .style-description;
        }
    }
}
</style>
