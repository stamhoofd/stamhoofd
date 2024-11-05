<template>
    <div v-if="platform.config.footerText.html" class="legal-footer">
        <div>
            <aside class="style-wysiwyg gray subtle-links" v-html="platform.config.footerText.html" />
            <div />
        </div>
    </div>
</template>

<script setup lang="ts">
import { usePlatform } from '../hooks';
const platform = usePlatform();

</script>
