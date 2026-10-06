<script setup lang="ts">
import HomeContentMap from './HomeContentMap.vue'
import type { HomeSection } from './types'

defineProps<{
  sections: HomeSection[]
}>()
</script>

<template>
  <section class="home-intro">
    <div class="home-intro__copy">
      <p class="terminal-comment"># BKMPG / interactive reading session</p>
      <p class="terminal-ok">[0] OK · 博客、教程与文档已就绪</p>
      <p class="terminal-command"><span>visitor@stylekit:~$</span> whoami<span class="terminal-cursor" aria-hidden="true" /></p>
      <h1 class="terminal-output">BKMPG</h1>
      <p>假发的博客、教程和文档站点。记录问题，留下可复用的答案。</p>
    </div>

    <h2 class="terminal-command"><span>visitor@stylekit:~$</span> ls -la ~/notes</h2>
    <HomeContentMap :sections="sections" />
  </section>
</template>
