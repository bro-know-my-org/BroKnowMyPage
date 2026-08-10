<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useData, useRoute } from 'vitepress'

const { frontmatter, isDark, page } = useData()
const route = useRoute()
const root = ref<HTMLElement>()
const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const server = import.meta.env.VITE_ARTALK_SERVER?.replace(/\/$/, '')
const site = import.meta.env.VITE_ARTALK_SITE || '兄弟懂我的页面'
const artalkCssUrl = '/vendor/artalk.css'
const shouldShow = computed(
  () => frontmatter.value.comments !== false && page.value.relativePath !== '404.md',
)
const heading = computed(() => frontmatter.value.layout === 'home' ? '留言' : '评论')

let observer: IntersectionObserver | undefined
let instance: {
  destroy?: () => void
  setDarkMode?: (darkMode: boolean) => void
} | undefined
let stylePromise: Promise<void> | undefined

function loadStyle(): Promise<void> {
  if (document.querySelector('link[data-artalk-style]')) return Promise.resolve()
  if (stylePromise) return stylePromise

  stylePromise = new Promise((resolve, reject) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = artalkCssUrl
    link.dataset.artalkStyle = 'true'
    link.addEventListener('load', () => resolve(), { once: true })
    link.addEventListener('error', () => reject(new Error('Artalk stylesheet failed to load')), { once: true })
    document.head.append(link)
  })
  return stylePromise
}

async function loadComments() {
  if (!server || status.value === 'loading' || status.value === 'ready') return

  status.value = 'loading'
  await nextTick()

  try {
    const [{ default: Artalk }] = await Promise.all([
      import('artalk'),
      loadStyle(),
    ])
    instance = Artalk.init({
      el: root.value?.querySelector<HTMLElement>('.artalk-mount') || '.artalk-mount',
      pageKey: route.path,
      pageTitle: page.value.title,
      server,
      site,
      darkMode: isDark.value,
    })
    status.value = 'ready'
  } catch (error) {
    console.error('Artalk failed to load:', error)
    status.value = 'error'
  }
}

function observe() {
  if (!shouldShow.value || !server || !root.value) return

  if (!('IntersectionObserver' in window)) {
    void loadComments()
    return
  }

  observer = new IntersectionObserver(
    ([entry]) => {
      if (entry?.isIntersecting) {
        observer?.disconnect()
        void loadComments()
      }
    },
    { rootMargin: '320px 0px' },
  )
  observer.observe(root.value)
}

function reset() {
  observer?.disconnect()
  instance?.destroy?.()
  instance = undefined
  status.value = 'idle'
  void nextTick(observe)
}

onMounted(observe)
onBeforeUnmount(() => {
  observer?.disconnect()
  instance?.destroy?.()
})
watch(() => route.path, reset)
watch(isDark, (darkMode) => instance?.setDarkMode?.(darkMode))
</script>

<template>
  <section v-if="shouldShow" ref="root" class="comments" aria-labelledby="comments-heading">
    <div class="comments__heading">
      <h2 id="comments-heading">{{ heading }}</h2>
    </div>
    <div v-if="server" class="artalk-mount" />
    <p v-else class="comments__notice">评论服务尚未配置，文章内容仍可正常阅读。</p>
    <p v-if="status === 'loading'" class="comments__notice">正在加载评论…</p>
    <p v-if="status === 'error'" class="comments__notice">评论暂时不可用，请稍后再试。</p>
  </section>
</template>
