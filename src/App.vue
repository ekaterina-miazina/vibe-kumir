<script setup lang="ts">
import { computed, ref } from 'vue'
import { parseProgram } from './core/language/parser'
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
const logs = ref<string[]>(['VibeKumir готов — создано с vibe-coding ✨'])
const errors = ref<string[]>([])

const isEditMode = ref(false)
const resizeWidth = ref(world.value.data.width)
const resizeHeight = ref(world.value.data.height)

const parseErrors = computed(() => parseProgram(code.value).errors)
const visibleWorld = computed(() => (isEditMode.value && draftWorld.value ? draftWorld.value : world.value))

function loadExample(key: keyof typeof examples) {
  code.value = examples[key]
}

function run() {
  errors.value = []
  const parsed = parseProgram(code.value)
  if (!parsed.program) {
    errors.value = parsed.errors
    return
  }
  const runtimeWorld = world.value.clone()
  const events = runProgram(parsed.program, runtimeWorld)
  world.value = runtimeWorld
  logs.value = events.map((event) => JSON.stringify(event))
  errors.value = events.filter((event) => event.type === 'runtimeError').map((event) => event.message)
}

function reset() {
  world.value = RobotWorld.create(6, 4)
  draftWorld.value = null
  isEditMode.value = false
  resizeWidth.value = world.value.data.width
  resizeHeight.value = world.value.data.height
  logs.value = ['Мир сброшен.']
  errors.value = []
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
  return hasWall ? '#7dd3fc' : '#27406f'
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
</script>

<template>
  <div class="app-shell">
    <header>
      <div>
        <h1>VibeKumir</h1>
        <p>Клиентская среда Робота, созданная с vibe-coding.</p>
      </div>
      <div class="toolbar">
        <select :disabled="isEditMode" @change="loadExample(($event.target as HTMLSelectElement).value as keyof typeof examples)">
          <option value="line">Пример: линия</option>
          <option value="wall">Пример: до стены</option>
        </select>
        <button :disabled="isEditMode" @click="run">Запустить</button>
        <button :disabled="isEditMode" @click="reset">Сбросить</button>
        <button v-if="!isEditMode" @click="enterEditMode">Редактировать обстановку</button>
      </div>
    </header>

    <main>
      <section class="panel">
        <h2>Редактор кода</h2>
        <textarea v-model="code" spellcheck="false" />
        <ul v-if="parseErrors.length" class="errors">
          <li v-for="error in parseErrors" :key="error">{{ error }}</li>
        </ul>
      </section>

      <section class="panel">
        <h2>Поле Робота</h2>

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

        <div class="grid" :style="{ gridTemplateColumns: `repeat(${visibleWorld.data.width}, 1fr)` }">
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
      </section>
    </main>

    <section class="panel console-panel">
      <h2>Консоль</h2>
      <pre>{{ logs.join('\n') }}</pre>
      <ul v-if="errors.length" class="errors runtime-errors">
        <li v-for="error in errors" :key="error">{{ error }}</li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.app-shell { padding: 24px; display: grid; gap: 20px; }
header, main { display: grid; gap: 20px; }
header { grid-template-columns: 1fr auto; align-items: center; }
.toolbar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
main { grid-template-columns: minmax(320px, 1.1fr) minmax(320px, 1fr); }
.panel { background: rgba(16, 23, 47, 0.92); border: 1px solid rgba(145, 190, 255, 0.18); border-radius: 20px; padding: 20px; box-shadow: 0 16px 40px rgba(0,0,0,.25); }
textarea { width: 100%; min-height: 420px; background: #09101f; color: #dce9ff; border: 1px solid #22345f; border-radius: 14px; padding: 16px; resize: vertical; }
.grid { display: grid; gap: 0; --wall-hit-area: 12px; --corner-dead-zone: 12px; }
.cell { width: 100%; aspect-ratio: 1 / 1; border-radius: 0; border-style: solid; background: #13203f; color: #9bb8ef; position: relative; overflow: visible; padding: 8px; text-align: left; }
.coords { position: absolute; left: 8px; top: 8px; font-size: 12px; opacity: 0.75; pointer-events: none; }
.cell.painted { background: linear-gradient(135deg, #f472b6, #8b5cf6); color: white; }
.cell.robot { box-shadow: inset 0 0 0 2px #f8fafc; }
.robot-icon { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font-size: 28px; user-select: none; pointer-events: none; }
.wall-toggle { position: absolute; background: transparent; transition: background .15s ease, box-shadow .15s ease; z-index: 3; }
.wall-toggle:hover { background: rgba(125, 211, 252, 0.18); }
.wall-toggle.active,
.wall-toggle.active:hover { background: transparent; }
.wall-v { right: calc(var(--wall-hit-area) / -2); top: 0; width: var(--wall-hit-area); height: calc(100% - var(--corner-dead-zone)); cursor: col-resize; }
.wall-h { left: 0; bottom: calc(var(--wall-hit-area) / -2); width: calc(100% - var(--corner-dead-zone)); height: var(--wall-hit-area); cursor: row-resize; }
.corner-dead-zone { position: absolute; right: calc(var(--corner-dead-zone) / -2); bottom: calc(var(--corner-dead-zone) / -2); width: var(--corner-dead-zone); height: var(--corner-dead-zone); z-index: 4; }
.edit-tools { display: grid; gap: 10px; margin-bottom: 12px; }
.edit-instructions { background: rgba(9, 16, 31, 0.8); border: 1px solid rgba(125, 211, 252, 0.24); border-radius: 12px; padding: 12px; }
.edit-instructions p { margin: 0; }
.tool-group { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.secondary-action { background: transparent; color: inherit; border: 1px solid rgba(145, 190, 255, 0.3); }
.resize-controls label { display: inline-flex; align-items: center; gap: 6px; }
.resize-controls input { width: 72px; background: #09101f; color: #dce9ff; border: 1px solid #22345f; border-radius: 8px; padding: 4px 8px; }
.errors { color: #fca5a5; }
.console-panel pre { white-space: pre-wrap; margin: 0; background: #09101f; border-radius: 12px; padding: 16px; }
@media (max-width: 900px) { main, header { grid-template-columns: 1fr; } }
</style>
