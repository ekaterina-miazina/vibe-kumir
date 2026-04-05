<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import DocsPage from './components/DocsPage.vue'
import MainPage from './components/MainPage.vue'

type ThemePreference = 'system' | 'light' | 'dark'
type ResolvedTheme = 'light' | 'dark'
type ViewName = 'main' | 'docs'

const themeStorageKey = 'vibe-kumir-theme'
const themePreference = ref<ThemePreference>('system')
const systemTheme = ref<ResolvedTheme>(getSystemTheme())
const resolvedTheme = computed<ResolvedTheme>(() =>
  themePreference.value === 'system' ? systemTheme.value : themePreference.value,
)
const currentView = ref<ViewName>(getViewFromPath(window.location.pathname))

let colorSchemeQuery: MediaQueryList | null = null

watch(themePreference, (value, previousValue) => {
  if (typeof window === 'undefined' || value === previousValue) return
  window.localStorage.setItem(themeStorageKey, value)
})

watch(
  resolvedTheme,
  (theme) => {
    if (typeof document === 'undefined') return
    document.documentElement.dataset.theme = theme
  },
  { immediate: true },
)

onMounted(() => {
  const storedThemePreference = readThemePreference()
  if (storedThemePreference) {
    themePreference.value = storedThemePreference
  }

  colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)')
  systemTheme.value = colorSchemeQuery.matches ? 'dark' : 'light'
  colorSchemeQuery.addEventListener('change', onSystemThemeChange)
  window.addEventListener('popstate', onPopState)
  normalizeCurrentPath()
})

onBeforeUnmount(() => {
  colorSchemeQuery?.removeEventListener('change', onSystemThemeChange)
  window.removeEventListener('popstate', onPopState)
})

function navigateTo(view: ViewName) {
  const path = view === 'docs' ? '/docs' : '/'
  currentView.value = view

  if (window.location.pathname !== path) {
    window.history.pushState({}, '', path)
  }
}

function onPopState() {
  currentView.value = getViewFromPath(window.location.pathname)
}

function normalizeCurrentPath() {
  const normalizedView = getViewFromPath(window.location.pathname)
  const normalizedPath = normalizedView === 'docs' ? '/docs' : '/'
  currentView.value = normalizedView

  if (window.location.pathname !== normalizedPath) {
    window.history.replaceState({}, '', normalizedPath)
  }
}

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark'
}

function readThemePreference() {
  if (typeof window === 'undefined') return null
  const storedValue = window.localStorage.getItem(themeStorageKey)
  return isThemePreference(storedValue) ? storedValue : null
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function onSystemThemeChange(event: MediaQueryListEvent) {
  systemTheme.value = event.matches ? 'dark' : 'light'
}

function getViewFromPath(pathname: string): ViewName {
  return pathname === '/docs' ? 'docs' : 'main'
}
</script>

<template>
  <MainPage
    v-show="currentView === 'main'"
    v-model:theme-preference="themePreference"
    :resolved-theme="resolvedTheme"
    @open-docs="navigateTo('docs')"
  />
  <DocsPage v-show="currentView === 'docs'" @open-main="navigateTo('main')" />
</template>
