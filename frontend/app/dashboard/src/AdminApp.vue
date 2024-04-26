<template>
    <div id="admin">
        Administratieportaal
    </div>
</template>

<script lang="ts">
import { ModalStackComponent } from "@simonbackx/vue-app-navigation";
import { ToastBox } from '@stamhoofd/components';
import { UrlHelper } from "@stamhoofd/networking";
import { Component, Vue } from "vue-property-decorator";


@Component({
    components: {
        ModalStackComponent,
        ToastBox
    },
})
export default class AdminApp extends Vue {
    mounted() {
        UrlHelper.fixedPrefix = "admin";
        UrlHelper.setUrl("/")
    }
}
</script>