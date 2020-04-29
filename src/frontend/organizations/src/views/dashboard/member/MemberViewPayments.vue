<template>
    <div class="view-payments">
        <h2>Betaling</h2>
        <main>
            <dl class="details-grid">
                <dt>Bedrag</dt>
                <dd>€ 40</dd>

                <dt>Bankrekening</dt>
                <dd>BE31 9789 7578 4155</dd>

                <dt>BIC</dt>
                <dd>KREDBEBB</dd>

                <dt>Mededeling</dt>
                <dd>Lidgeld 123</dd>

                <dt>Status</dt>
                <dd v-if="member.paid">
                    Betaald
                </dd>
                <dd v-else>
                    Nog niet betaald
                </dd>
            </dl>
        </main>

        <STToolbar v-if="!member.paid">
            <template #left />
            <template #right>
                <button class="button primary">
                    Markeer als betaald
                    <div class="dropdown" @click.stop="" />
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { Member } from "@stamhoofd-frontend/models";
import STToolbar from "@stamhoofd/shared/components/navigation/STToolbar.vue";
import { Component, Prop,Vue } from "vue-property-decorator";

@Component({ components: { STToolbar } })
export default class MemberViewPayments extends Vue {
    @Prop()
    member!: Member;
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/base/text-styles.scss';
@use '@stamhoofd/scss/layout/view.scss';

.view-payments {
    padding: 10px 0;
    flex-grow: 1;
    display: flex;
    flex-direction: column;

    > h2 {
        @extend .style-title-2;
        margin: 20px 0;
    }
}
</style>
