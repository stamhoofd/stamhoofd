<template>
    <MetaLogo :meta-data="metaData" :name="name" />
</template>

<script lang="ts">
import { Organization, Webshop } from "@stamhoofd/structures";
import { Component, Prop, Vue } from "@simonbackx/vue-app-navigation/classes";

import MetaLogo from "./MetaLogo.vue";

@Component({
    components: {
        MetaLogo
    }
})
export default class OrganizationLogo extends Vue {
    @Prop({ required: true })
        organization!: Organization

    @Prop({ required: false, default: null })
        webshop: Webshop | null

    get metaData() {
        if (!this.webshop || !this.webshop.meta.useLogo) {
            return this.organization.meta
        }
        return this.webshop.meta
    }

    get name() {
        if (!this.webshop || !this.webshop.meta.useLogo) {
            return this.organization.name
        }
        return this.webshop.meta.name
    }
}
</script>