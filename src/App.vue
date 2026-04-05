<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import DocsPage from './components/DocsPage.vue'
import MainPage from './components/MainPage.vue'

type ThemePreference = 'system' | 'light' | 'dark'
type ResolvedTheme = 'light' | 'dark'
type ViewName = 'main' | 'docs'

const themeStorageKey = 'vibe-kumir-theme'
const appBasePath = normalizeBasePath(import.meta.env.BASE_URL)
const themePreference = ref<ThemePreference>('system')
const systemTheme = ref<ResolvedTheme>(getSystemTheme())
const resolvedTheme = computed<ResolvedTheme>(() =>
  themePreference.value === 'system' ? systemTheme.value : themePreference.value,
)
const currentView = ref<ViewName>(getViewFromLocation(window.location))

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
  const path = buildPathForView(view)
  currentView.value = view

  if (buildCurrentLocationKey(window.location) !== path) {
    window.history.pushState({}, '', path)
  }
}

function onPopState() {
  currentView.value = getViewFromLocation(window.location)
}

function normalizeCurrentPath() {
  const normalizedView = getViewFromLocation(window.location)
  const normalizedPath = buildPathForView(normalizedView)
  currentView.value = normalizedView

  if (buildCurrentLocationKey(window.location) !== normalizedPath) {
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

function getViewFromLocation(location: Location): ViewName {
  const hashRoute = getViewFromHash(location.hash)
  if (hashRoute) {
    return hashRoute
  }

  return getViewFromPathname(location.pathname)
}

function getViewFromHash(hash: string): ViewName | null {
  const normalizedHash = hash.replace(/^#\/?/, '').replace(/\/+$/, '')
  if (normalizedHash === '') return 'main'
  return normalizedHash === 'docs' ? 'docs' : null
}

function getViewFromPathname(pathname: string): ViewName {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/'
  const docsPaths = new Set<string>(['/docs'])

  if (appBasePath !== '/') {
    docsPaths.add(`${appBasePath.replace(/\/$/, '')}/docs`)
  }

  return docsPaths.has(normalizedPath) ? 'docs' : 'main'
}

function buildPathForView(view: ViewName) {
  return view === 'docs' ? `${appBasePath}#docs` : appBasePath
}

function buildCurrentLocationKey(location: Location) {
  return `${location.pathname}${location.hash}`
}

function normalizeBasePath(baseUrl: string) {
  if (!baseUrl || baseUrl === './') return '/'
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
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
