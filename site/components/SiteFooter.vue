<script setup lang="ts">
import type { SiteMessages } from '../i18n'

defineProps<{ t: SiteMessages }>()
</script>

<template>
    <footer class="site-footer">
        <div class="site-footer__inner">
            <span>{{ t.footer }}</span>
            <a :href="t.docsHref">{{ t.docs }}</a>
            <a href="https://github.com/dadashi44/vue-why-render">GitHub</a>
            <a href="https://www.npmjs.com/package/vue-why-render">npm</a>
            <a :href="t.docsHref + 'guides/vscode/'">VS Code extension</a>
            <a href="cases/bigplay/">{{ t.caseLink }}</a>
        </div>
    </footer>
</template>
