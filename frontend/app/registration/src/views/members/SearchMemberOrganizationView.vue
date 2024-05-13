<template>
    <div class="st-view">
        <STNavigationBar title="Zoek een groep" />

        <main>
            <h1>Zoek een groep waar je {{ member.patchedMember.firstName }} wilt inschrijven</h1>

            <form class="input-icon-container icon search gray" @submit.prevent>
                <input ref="input" v-model="query" autofocus class="input" placeholder="Zoek op naam of postcode" name="search" inputmode="search" type="search" enterkeyhint="search" autocorrect="off" autocomplete="off" :spellcheck="false" autocapitalize="off">
            </form>
        </main>
    </div>
</template>

<script setup lang="ts">
import { PlatformMember } from '@stamhoofd/structures';
import { ref } from 'vue';

defineProps<{
    member: PlatformMember;
}>();

const query = ref("");

</script>
