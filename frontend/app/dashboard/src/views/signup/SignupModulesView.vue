<template>
    <form class="st-view" @submit.prevent="goNext">
        <STNavigationBar :title="title" :dismiss="canDismiss" :pop="canPop" />

        <main>
            <h1>
                {{ title }}
            </h1>
            <SmoothModuleSettingsBox />
        </main>
    </form>
</template>

<script lang="ts">
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';

import SmoothModuleSettingsBox from '../dashboard/settings/SmoothModuleSettingsBox.vue';

const title = $t('Waarmee wil je beginnen?');
const dismiss = useDismiss();
const canDismiss = useCanDismiss();
const canPop = useCanPop();

function goNext() {
    dismiss({ force: true }).catch(console.error);
}
</script>
