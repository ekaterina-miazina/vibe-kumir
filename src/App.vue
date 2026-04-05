<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { applyEnterIndentation, applyTabIndentation } from './editor/indentation'
import { parseProgram, type ParseDiagnostic } from './core/language/parser'
import { runProgram } from './core/runtime/interpreter'
import { RobotWorld } from './core/robot/world'

const examples = {
  line: `использовать Робот
алг линия
нач
  нц 5 раз
    закрасить
    если справа свободно то
      вправо
    все
  кц
кон`,
  wall: `использовать Робот
алг до_стены
нач
  нц пока справа свободно
    вправо
  кц
кон`,
}

const code = ref(examples.line)
const world = ref(RobotWorld.create(6, 4))
const draftWorld = ref<RobotWorld | null>(null)
const logs = ref<string[]>(['ВайбКумир готов — создано с vibe-coding ✨'])
const runtimeErrors = ref<ParseDiagnostic[]>([])
const editorRef = ref<HTMLTextAreaElement | null>(null)
const editorScrollTop = ref(0)
const editorScrollLeft = ref(0)

const isEditMode = ref(false)
const resizeWidth = ref(world.value.data.width)
const resizeHeight = ref(world.value.data.height)
const minWorldZoom = 60
const maxWorldZoom = 160
const defaultWorldZoom = 100
const baseCellSize = 88
const worldZoom = ref(defaultWorldZoom)
const themeStorageKey = 'vibe-kumir-theme'

type ThemePreference = 'system' | 'light' | 'dark'
type ResolvedTheme = 'light' | 'dark'

const themePreference = ref<ThemePreference>('system')
const systemTheme = ref<ResolvedTheme>(getSystemTheme())

const parsedProgram = computed(() => parseProgram(code.value))
const lineNumbers = computed(() => Array.from({ length: code.value.split('\n').length }, (_, index) => index + 1))
const parseErrors = computed(() => parsedProgram.value.errors)
const formattedParseErrors = computed(() => parseErrors.value.map(formatDiagnostic))
const formattedRuntimeErrors = computed(() => runtimeErrors.value.map(formatDiagnostic))
const visibleWorld = computed(() => (isEditMode.value && draftWorld.value ? draftWorld.value : world.value))
const highlightedEditorLines = computed(() => buildEditorLines(code.value, parseErrors.value))
const resolvedTheme = computed<ResolvedTheme>(() =>
  themePreference.value === 'system' ? systemTheme.value : themePreference.value,
)
const lineNumbersStyle = computed(() => ({
  transform: `translateY(${-editorScrollTop.value}px)`,
}))
const editorOverlayStyle = computed(() => ({
  transform: `translate(${-editorScrollLeft.value}px, ${-editorScrollTop.value}px)`,
}))
const worldGridStyle = computed(() => ({
  '--cell-size': `${Math.round((baseCellSize * worldZoom.value) / 100)}px`,
  gridTemplateColumns: `repeat(${visibleWorld.value.data.width}, var(--cell-size))`,
  '--wall-hit-area': `${Math.max(12, Math.round((baseCellSize * worldZoom.value * 0.18) / 100))}px`,
  '--corner-dead-zone': `${Math.max(12, Math.round((baseCellSize * worldZoom.value * 0.18) / 100))}px`,
}))
const worldZoomLabel = computed(() => `${worldZoom.value}%`)

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
})

onBeforeUnmount(() => {
  colorSchemeQuery?.removeEventListener('change', onSystemThemeChange)
})

function loadExample(key: keyof typeof examples) {
  code.value = examples[key]
}

function run() {
  runtimeErrors.value = []
  const parsed = parsedProgram.value
  if (!parsed.program) {
    return
  }
  const runtimeWorld = world.value.clone()
  const events = runProgram(parsed.program, runtimeWorld)
  world.value = runtimeWorld
  logs.value = events.map((event) => JSON.stringify(event))
  runtimeErrors.value = events
    .filter((event) => event.type === 'runtimeError')
    .map((event) => ({ message: event.message, line: event.line }))
}

function reset() {
  world.value = RobotWorld.create(6, 4)
  draftWorld.value = null
  isEditMode.value = false
  resizeWidth.value = world.value.data.width
  resizeHeight.value = world.value.data.height
  logs.value = ['Мир сброшен.']
  runtimeErrors.value = []
}

function enterEditMode() {
  draftWorld.value = world.value.clone()
  resizeWidth.value = draftWorld.value.data.width
  resizeHeight.value = draftWorld.value.data.height
  isEditMode.value = true
}

function applyResize() {
  const targetWorld = isEditMode.value ? draftWorld.value : world.value
  if (!targetWorld) return

  targetWorld.resizeTo(Math.max(2, resizeWidth.value), Math.max(2, resizeHeight.value))
  resizeWidth.value = targetWorld.data.width
  resizeHeight.value = targetWorld.data.height
}

function updateWorldZoom(nextZoom: number) {
  worldZoom.value = Math.min(maxWorldZoom, Math.max(minWorldZoom, nextZoom))
}

function increaseWorldZoom() {
  updateWorldZoom(worldZoom.value + 10)
}

function decreaseWorldZoom() {
  updateWorldZoom(worldZoom.value - 10)
}

function resetWorldZoom() {
  updateWorldZoom(defaultWorldZoom)
}

function onCellAction(x: number, y: number) {
  if (!isEditMode.value || !draftWorld.value) return
  draftWorld.value.togglePaint(x, y)
}

function toggleVerticalWall(x: number, y: number) {
  if (!isEditMode.value || !draftWorld.value) return
  draftWorld.value.toggleVerticalWall(x, y)
}

function toggleHorizontalWall(x: number, y: number) {
  if (!isEditMode.value || !draftWorld.value) return
  draftWorld.value.toggleHorizontalWall(x, y)
}

function onCellContextMenu(event: MouseEvent, x: number, y: number) {
  if (!isEditMode.value || !draftWorld.value) return
  event.preventDefault()
  event.stopPropagation()
  draftWorld.value.setRobot(x, y)
}

function saveEdits() {
  if (!draftWorld.value) return
  world.value = draftWorld.value.clone()
  draftWorld.value = null
  isEditMode.value = false
  resizeWidth.value = world.value.data.width
  resizeHeight.value = world.value.data.height
}

function cancelEdits() {
  draftWorld.value = null
  isEditMode.value = false
  resizeWidth.value = world.value.data.width
  resizeHeight.value = world.value.data.height
}

function hasVerticalWall(x: number, y: number) {
  return visibleWorld.value.data.vWalls[y][x]
}

function hasHorizontalWall(x: number, y: number) {
  return visibleWorld.value.data.hWalls[y][x]
}

function isRobotCell(x: number, y: number) {
  return visibleWorld.value.data.robot.x === x && visibleWorld.value.data.robot.y === y
}

function borderWidth(hasWall: boolean) {
  return hasWall ? '4px' : '1px'
}

function borderColor(hasWall: boolean) {
  return hasWall ? 'var(--wall-color-active)' : 'var(--wall-color-idle)'
}

function cellStyle(x: number, y: number) {
  const topWall = hasHorizontalWall(x, y)
  const bottomWall = hasHorizontalWall(x, y + 1)
  const leftWall = hasVerticalWall(x, y)
  const rightWall = hasVerticalWall(x + 1, y)

  return {
    borderTopWidth: borderWidth(topWall),
    borderBottomWidth: borderWidth(bottomWall),
    borderLeftWidth: borderWidth(leftWall),
    borderRightWidth: borderWidth(rightWall),
    borderTopColor: borderColor(topWall),
    borderBottomColor: borderColor(bottomWall),
    borderLeftColor: borderColor(leftWall),
    borderRightColor: borderColor(rightWall),
  }
}

function cellLabel(x: number, y: number) {
  return `${x},${y}`
}

function formatDiagnostic(diagnostic: ParseDiagnostic) {
  return diagnostic.line ? `Строка ${diagnostic.line}: ${diagnostic.message}` : diagnostic.message
}

function buildEditorLines(source: string, diagnostics: ParseDiagnostic[]) {
  const sourceLines = source.split('\n')
  const rangesByLine = new Map<number, Array<{ startOffset: number; endOffset: number }>>()

  for (const diagnostic of diagnostics) {
    if (
      diagnostic.line === undefined ||
      diagnostic.startOffset === undefined ||
      diagnostic.endOffset === undefined
    ) {
      continue
    }

    const lineText = sourceLines[diagnostic.line - 1] ?? ''
    const startOffset = Math.max(0, Math.min(diagnostic.startOffset, lineText.length))
    const endOffset = Math.max(startOffset, Math.min(diagnostic.endOffset, lineText.length))
    if (startOffset === endOffset) continue

    const lineRanges = rangesByLine.get(diagnostic.line) ?? []
    lineRanges.push({ startOffset, endOffset })
    rangesByLine.set(diagnostic.line, lineRanges)
  }

  return sourceLines.map((lineText, index) => ({
    key: `line-${index + 1}`,
    segments: buildLineSegments(lineText, normalizeRanges(rangesByLine.get(index + 1) ?? []), index),
  }))
}

function normalizeRanges(ranges: Array<{ startOffset: number; endOffset: number }>) {
  const sortedRanges = [...ranges].sort((left, right) => left.startOffset - right.startOffset)
  const mergedRanges: Array<{ startOffset: number; endOffset: number }> = []

  for (const range of sortedRanges) {
    const lastRange = mergedRanges[mergedRanges.length - 1]
    if (!lastRange || range.startOffset > lastRange.endOffset) {
      mergedRanges.push({ ...range })
      continue
    }
    lastRange.endOffset = Math.max(lastRange.endOffset, range.endOffset)
  }

  return mergedRanges
}

function buildLineSegments(
  lineText: string,
  ranges: Array<{ startOffset: number; endOffset: number }>,
  lineIndex: number,
) {
  if (ranges.length === 0) {
    return [{ key: `segment-${lineIndex}-plain`, text: lineText, isError: false }]
  }

  const segments: Array<{ key: string; text: string; isError: boolean }> = []
  let cursor = 0

  for (const range of ranges) {
    if (range.startOffset > cursor) {
      segments.push({
        key: `segment-${lineIndex}-${cursor}-plain`,
        text: lineText.slice(cursor, range.startOffset),
        isError: false,
      })
    }

    segments.push({
      key: `segment-${lineIndex}-${range.startOffset}-error`,
      text: lineText.slice(range.startOffset, range.endOffset),
      isError: true,
    })
    cursor = range.endOffset
  }

  if (cursor < lineText.length) {
    segments.push({
      key: `segment-${lineIndex}-${cursor}-tail`,
      text: lineText.slice(cursor),
      isError: false,
    })
  }

  return segments
}

function syncEditorScroll() {
  if (!editorRef.value) return
  editorScrollTop.value = editorRef.value.scrollTop
  editorScrollLeft.value = editorRef.value.scrollLeft
}

function onEditorKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLTextAreaElement | null
  if (!target) return

  if (event.key === 'Enter') {
    event.preventDefault()
    applyEditorEdit(
      target,
      applyEnterIndentation(code.value, target.selectionStart, target.selectionEnd),
    )
    return
  }

  if (event.key === 'Tab') {
    event.preventDefault()
    applyEditorEdit(
      target,
      applyTabIndentation(code.value, target.selectionStart, target.selectionEnd, event.shiftKey),
    )
  }
}

function applyEditorEdit(
  target: HTMLTextAreaElement,
  result: { value: string; selectionStart: number; selectionEnd: number },
) {
  const { scrollTop, scrollLeft } = target
  code.value = result.value

  void nextTick(() => {
    if (!editorRef.value) return
    editorRef.value.focus()
    editorRef.value.setSelectionRange(result.selectionStart, result.selectionEnd)
    editorRef.value.scrollTop = scrollTop
    editorRef.value.scrollLeft = scrollLeft
    syncEditorScroll()
  })
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
</script>

<template>
  <div class="app-shell">
    <header>
      <div>
        <h1>ВайбКумир</h1>
        <p>Клиентская среда Робота, созданная с vibe-coding.</p>
      </div>
      <div class="toolbar">
        <select
          :disabled="isEditMode"
          aria-label="Пример программы"
          @change="loadExample(($event.target as HTMLSelectElement).value as keyof typeof examples)"
        >
          <option value="line">Пример: линия</option>
          <option value="wall">Пример: до стены</option>
        </select>
        <select v-model="themePreference" class="theme-select" aria-label="Тема оформления" data-testid="theme-select">
          <option value="system">Система</option>
          <option value="light">Светлая</option>
          <option value="dark">Тёмная</option>
        </select>
        <button :disabled="isEditMode" @click="run">Запустить</button>
        <button :disabled="isEditMode" @click="reset">Сбросить</button>
        <button v-if="!isEditMode" @click="enterEditMode">Редактировать обстановку</button>
      </div>
    </header>

    <main>
      <section class="panel">
        <h2>Редактор кода</h2>
        <div class="editor-shell">
          <div class="line-numbers" data-testid="editor-line-numbers" aria-hidden="true">
            <div class="line-numbers-content" data-testid="editor-line-numbers-content" :style="lineNumbersStyle">
              <div v-for="lineNumber in lineNumbers" :key="lineNumber" class="line-number" data-testid="editor-line-number">
                {{ lineNumber }}
              </div>
            </div>
          </div>
          <div class="editor-pane">
            <div class="editor-overlay" data-testid="editor-overlay" aria-hidden="true">
              <div class="editor-overlay-content" data-testid="editor-overlay-content" :style="editorOverlayStyle">
                <div v-for="line in highlightedEditorLines" :key="line.key" class="editor-overlay-line">
                  <span
                    v-for="segment in line.segments"
                    :key="segment.key"
                    class="editor-overlay-segment"
                    :class="{ 'editor-overlay-error': segment.isError }"
                    :data-testid="segment.isError ? 'editor-error-underline' : undefined"
                  >
                    {{ segment.text }}
                  </span>
                </div>
              </div>
            </div>
            <textarea
              ref="editorRef"
              v-model="code"
              spellcheck="false"
              wrap="off"
              data-testid="code-editor"
              @keydown="onEditorKeydown"
              @scroll="syncEditorScroll"
            />
          </div>
        </div>
        <ul v-if="formattedParseErrors.length" class="errors">
          <li v-for="error in formattedParseErrors" :key="error">{{ error }}</li>
        </ul>
      </section>

      <section class="panel">
        <h2>Поле Робота</h2>

        <div class="tool-group world-zoom-controls">
          <span class="zoom-label">Масштаб поля</span>
          <button
            type="button"
            :disabled="worldZoom <= minWorldZoom"
            aria-label="Уменьшить масштаб поля"
            @click="decreaseWorldZoom"
          >
            -
          </button>
          <label class="zoom-range">
            <span class="sr-only">Масштаб поля</span>
            <input
              v-model.number="worldZoom"
              data-testid="world-zoom-slider"
              type="range"
              :min="minWorldZoom"
              :max="maxWorldZoom"
              step="10"
            />
          </label>
          <button
            type="button"
            :disabled="worldZoom >= maxWorldZoom"
            aria-label="Увеличить масштаб поля"
            @click="increaseWorldZoom"
          >
            +
          </button>
          <button type="button" class="secondary-action" @click="resetWorldZoom">100%</button>
          <output class="zoom-value" data-testid="world-zoom-value">{{ worldZoomLabel }}</output>
        </div>

        <div v-if="isEditMode" class="edit-tools">
          <div class="edit-instructions">
            <p>Левый клик по клетке: закрасить или снять закраску.</p>
            <p>Левый клик по границе клеток: поставить или убрать стену.</p>
            <p>Правый клик по клетке: установить начальное положение робота.</p>
          </div>
          <div class="tool-group resize-controls">
            <label>Ширина <input v-model.number="resizeWidth" type="number" min="2" /></label>
            <label>Высота <input v-model.number="resizeHeight" type="number" min="2" /></label>
            <button @click="applyResize">Применить размер</button>
          </div>
          <div class="tool-group edit-actions">
            <button @click="saveEdits">Сохранить</button>
            <button class="secondary-action" @click="cancelEdits">Отмена</button>
          </div>
        </div>

        <div class="grid-scroll" data-testid="world-grid-scroll">
          <div class="grid" data-testid="world-grid" :style="worldGridStyle">
            <template v-for="(row, y) in visibleWorld.data.paint" :key="`row-${y}`">
              <button
                v-for="(cell, x) in row"
                :key="`${x}-${y}`"
                class="cell"
                :class="{ painted: cell, robot: isRobotCell(x, y), editing: isEditMode }"
                :style="cellStyle(x, y)"
                :data-testid="`cell-${x}-${y}`"
                :data-cell="`${x},${y}`"
                :data-painted="cell ? 'true' : 'false'"
                :data-robot="isRobotCell(x, y) ? 'true' : 'false'"
                :data-top-wall="hasHorizontalWall(x, y) ? 'true' : 'false'"
                :data-bottom-wall="hasHorizontalWall(x, y + 1) ? 'true' : 'false'"
                :data-left-wall="hasVerticalWall(x, y) ? 'true' : 'false'"
                :data-right-wall="hasVerticalWall(x + 1, y) ? 'true' : 'false'"
                @click="onCellAction(x, y)"
                @contextmenu="onCellContextMenu($event, x, y)"
              >
                <span class="coords">{{ cellLabel(x, y) }}</span>
                <span v-if="isRobotCell(x, y)" class="robot-icon">🤖</span>
                <span
                  v-if="isEditMode && x < visibleWorld.data.width - 1"
                  :data-testid="`vwall-toggle-${x + 1}-${y}`"
                  class="wall-toggle wall-v"
                  :class="{ active: hasVerticalWall(x + 1, y) }"
                  @click.stop="toggleVerticalWall(x + 1, y)"
                  @contextmenu.prevent.stop
                />
                <span
                  v-if="isEditMode && y < visibleWorld.data.height - 1"
                  :data-testid="`hwall-toggle-${x}-${y + 1}`"
                  class="wall-toggle wall-h"
                  :class="{ active: hasHorizontalWall(x, y + 1) }"
                  @click.stop="toggleHorizontalWall(x, y + 1)"
                  @contextmenu.prevent.stop
                />
                <span
                  v-if="isEditMode && x < visibleWorld.data.width - 1 && y < visibleWorld.data.height - 1"
                  :data-testid="`corner-dead-zone-${x}-${y}`"
                  class="corner-dead-zone"
                  @click.stop
                  @contextmenu.prevent.stop
                />
              </button>
            </template>
          </div>
        </div>
      </section>
    </main>

    <section class="panel console-panel">
      <h2>Консоль</h2>
      <pre>{{ logs.join('\n') }}</pre>
      <ul v-if="formattedRuntimeErrors.length" class="errors runtime-errors">
        <li v-for="error in formattedRuntimeErrors" :key="error">{{ error }}</li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.app-shell { max-width: 1440px; margin: 0 auto; padding: 24px; display: grid; gap: 20px; }
header, main { display: grid; gap: 20px; }
header { grid-template-columns: minmax(0, 1fr) auto; align-items: start; }
header h1 { margin: 0; font-size: clamp(2rem, 2.8vw, 2.8rem); }
header p { margin: 8px 0 0; color: var(--muted-text); }
.toolbar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
button:not(.cell),
select,
input:not([type='range']),
textarea {
  border-radius: 12px;
  border: 1px solid var(--control-border);
  background: var(--control-background);
  color: var(--control-text);
  transition:
    background 0.16s ease,
    border-color 0.16s ease,
    color 0.16s ease,
    box-shadow 0.16s ease,
    opacity 0.16s ease;
}
button:not(.cell),
select {
  min-height: 42px;
  padding: 0 14px;
}
button:not(.cell) { cursor: pointer; }
button:not(.cell):hover,
select:hover,
input:not([type='range']):hover {
  background: var(--control-background-hover);
  border-color: var(--control-border-strong);
}
button:not(.cell):focus-visible,
select:focus-visible,
input:not([type='range']):focus-visible,
textarea:focus-visible {
  outline: none;
  border-color: var(--control-border-strong);
  box-shadow: 0 0 0 3px var(--control-focus-ring);
}
button:not(.cell):disabled,
select:disabled,
input:disabled {
  cursor: not-allowed;
  background: var(--control-disabled-background);
  color: var(--control-disabled-text);
  border-color: var(--control-border);
  opacity: 0.78;
}
.theme-select { min-width: 140px; }
main { grid-template-columns: minmax(320px, 1.1fr) minmax(320px, 1fr); }
.panel {
  background: var(--panel-background);
  border: 1px solid var(--panel-border);
  border-radius: 20px;
  padding: 20px;
  box-shadow: var(--panel-shadow);
  backdrop-filter: blur(18px);
}
.panel h2 { margin: 0 0 16px; }
.editor-shell {
  --editor-line-height: 1.5;
  --editor-padding: 16px;
  --editor-font: 15px/var(--editor-line-height) 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: stretch;
  background: var(--editor-shell-background);
  border: 1px solid var(--editor-shell-border);
  border-radius: 14px;
  overflow: hidden;
}
.line-numbers,
.editor-pane,
textarea {
  min-height: 420px;
  font: var(--editor-font);
  line-height: var(--editor-line-height);
}
.editor-pane {
  position: relative;
  min-width: 0;
}
.line-numbers {
  position: relative;
  width: 72px;
  background: var(--editor-line-number-background);
  color: var(--editor-line-number-text);
  text-align: right;
  user-select: none;
  overflow: hidden;
  border-right: 1px solid var(--editor-shell-border);
}
.line-numbers-content {
  position: absolute;
  inset: 0;
  padding: var(--editor-padding) 12px var(--editor-padding) 16px;
  will-change: transform;
}
.line-number { white-space: pre; }
.editor-overlay {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}
.editor-overlay-content {
  width: max-content;
  min-width: 100%;
  padding: var(--editor-padding);
  color: var(--editor-overlay-text);
  font: var(--editor-font);
  line-height: var(--editor-line-height);
  white-space: pre;
  will-change: transform;
}
.editor-overlay-line { min-height: calc(1em * var(--editor-line-height)); }
.editor-overlay-segment { white-space: pre; }
.editor-overlay-error {
  text-decoration-line: underline;
  text-decoration-style: wavy;
  text-decoration-color: var(--editor-error);
  text-decoration-thickness: 1.5px;
  text-underline-offset: 3px;
}
textarea {
  position: relative;
  z-index: 1;
  width: 100%;
  background: transparent;
  color: transparent;
  caret-color: var(--editor-caret);
  -webkit-text-fill-color: transparent;
  border: 0;
  padding: var(--editor-padding);
  resize: vertical;
  outline: none;
  white-space: pre;
  overflow-wrap: normal;
  tab-size: 2;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.world-zoom-controls { margin-bottom: 12px; }
.zoom-label { font-weight: 600; }
.zoom-range { display: inline-flex; align-items: center; flex: 1 1 220px; max-width: 280px; }
.zoom-range input { accent-color: var(--accent-color); }
.zoom-range input { width: 100%; }
.zoom-value { min-width: 52px; font-variant-numeric: tabular-nums; color: var(--muted-text); }
.grid-scroll {
  overflow: auto;
  padding: 4px;
  border-radius: 16px;
  background: var(--grid-scroll-background);
}
.grid {
  display: grid;
  gap: 0;
  width: max-content;
  min-width: 100%;
  justify-content: start;
  --wall-hit-area: 12px;
  --corner-dead-zone: 12px;
}
.cell {
  width: var(--cell-size);
  aspect-ratio: 1 / 1;
  border-radius: 0;
  border-style: solid;
  background: var(--cell-background);
  color: var(--cell-text);
  position: relative;
  overflow: visible;
  padding: clamp(6px, calc(var(--cell-size) * 0.11), 10px);
  text-align: left;
}
.coords {
  position: absolute;
  left: clamp(6px, calc(var(--cell-size) * 0.11), 10px);
  top: clamp(6px, calc(var(--cell-size) * 0.11), 10px);
  font-size: clamp(11px, calc(var(--cell-size) * 0.16), 15px);
  opacity: 0.75;
  pointer-events: none;
}
.cell.painted { background: var(--painted-cell-background); color: var(--painted-cell-text); }
.cell.robot { box-shadow: inset 0 0 0 2px var(--robot-ring); }
.robot-icon {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  font-size: clamp(24px, calc(var(--cell-size) * 0.38), 40px);
  user-select: none;
  pointer-events: none;
}
.wall-toggle { position: absolute; background: transparent; transition: background .15s ease, box-shadow .15s ease; z-index: 3; }
.wall-toggle:hover { background: var(--wall-hover); }
.wall-toggle.active,
.wall-toggle.active:hover { background: transparent; }
.wall-v { right: calc(var(--wall-hit-area) / -2); top: 0; width: var(--wall-hit-area); height: calc(100% - var(--corner-dead-zone)); cursor: col-resize; }
.wall-h { left: 0; bottom: calc(var(--wall-hit-area) / -2); width: calc(100% - var(--corner-dead-zone)); height: var(--wall-hit-area); cursor: row-resize; }
.corner-dead-zone { position: absolute; right: calc(var(--corner-dead-zone) / -2); bottom: calc(var(--corner-dead-zone) / -2); width: var(--corner-dead-zone); height: var(--corner-dead-zone); z-index: 4; }
.edit-tools { display: grid; gap: 10px; margin-bottom: 12px; }
.edit-instructions { background: var(--instruction-background); border: 1px solid var(--instruction-border); border-radius: 12px; padding: 12px; }
.edit-instructions p { margin: 0; }
.tool-group { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.secondary-action { background: transparent; color: inherit; border: 1px solid var(--secondary-border); }
.secondary-action:hover { background: var(--control-background-hover); }
.resize-controls label { display: inline-flex; align-items: center; gap: 6px; }
.resize-controls input {
  width: 72px;
  min-height: 38px;
  background: var(--input-background);
  color: var(--input-text);
  border: 1px solid var(--input-border);
  border-radius: 8px;
  padding: 4px 8px;
}
.errors { color: var(--error-text); }
.errors li + li { margin-top: 4px; }
.console-panel pre {
  white-space: pre-wrap;
  margin: 0;
  background: var(--console-background);
  border-radius: 12px;
  padding: 16px;
}
@media (max-width: 900px) {
  main,
  header {
    grid-template-columns: 1fr;
  }

  .toolbar {
    justify-content: flex-start;
  }
}
</style>
