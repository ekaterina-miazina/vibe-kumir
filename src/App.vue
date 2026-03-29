<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
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

type EditorTool = 'paint' | 'robot' | 'vwall' | 'hwall'

const code = ref(examples.line)
const world = ref(RobotWorld.create(6, 4))
const logs = ref<string[]>(['VibeKumir готов — создано с vibe-coding ✨'])
const errors = ref<string[]>([])

const isEditMode = ref(false)
const activeTool = ref<EditorTool>('paint')
const resizeWidth = ref(world.value.data.width)
const resizeHeight = ref(world.value.data.height)
const robotDragActive = ref(false)

const parseErrors = computed(() => parseProgram(code.value).errors)

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
  resizeWidth.value = world.value.data.width
  resizeHeight.value = world.value.data.height
  logs.value = ['Мир сброшен.']
  errors.value = []
}

function toggleEditMode() {
  isEditMode.value = !isEditMode.value
  if (!isEditMode.value) {
    robotDragActive.value = false
  }
}

function applyResize() {
  world.value.resizeTo(Math.max(2, resizeWidth.value), Math.max(2, resizeHeight.value))
}

function onCellAction(x: number, y: number) {
  if (!isEditMode.value) {
    world.value.togglePaint(x, y)
    return
  }
  if (activeTool.value === 'paint') {
    world.value.togglePaint(x, y)
  }
  if (activeTool.value === 'robot') {
    world.value.setRobot(x, y)
  }
}

function toggleVerticalWall(x: number, y: number) {
  if (!isEditMode.value || activeTool.value !== 'vwall') return
  world.value.toggleVerticalWall(x, y)
}

function toggleHorizontalWall(x: number, y: number) {
  if (!isEditMode.value || activeTool.value !== 'hwall') return
  world.value.toggleHorizontalWall(x, y)
}

function startRobotDrag() {
  if (!isEditMode.value || activeTool.value !== 'robot') return
  robotDragActive.value = true
}

function onCellEnter(x: number, y: number) {
  if (robotDragActive.value) {
    world.value.setRobot(x, y)
  }
}

function stopRobotDrag() {
  robotDragActive.value = false
}

onMounted(() => {
  window.addEventListener('mouseup', stopRobotDrag)
})

onBeforeUnmount(() => {
  window.removeEventListener('mouseup', stopRobotDrag)
})

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
        <select @change="loadExample(($event.target as HTMLSelectElement).value as keyof typeof examples)">
          <option value="line">Пример: линия</option>
          <option value="wall">Пример: до стены</option>
        </select>
        <button @click="run">Запустить</button>
        <button @click="reset">Сбросить</button>
        <button @click="toggleEditMode">{{ isEditMode ? 'Выйти из режима редактирования' : 'Редактировать обстановку' }}</button>
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
          <div class="tool-group">
            <button :class="{ active: activeTool === 'paint' }" @click="activeTool = 'paint'">Закраска</button>
            <button :class="{ active: activeTool === 'robot' }" @click="activeTool = 'robot'">Положение робота</button>
            <button :class="{ active: activeTool === 'vwall' }" @click="activeTool = 'vwall'">Вертикальные стены</button>
            <button :class="{ active: activeTool === 'hwall' }" @click="activeTool = 'hwall'">Горизонтальные стены</button>
          </div>
          <div class="tool-group resize-controls">
            <label>Ширина <input v-model.number="resizeWidth" type="number" min="2" /></label>
            <label>Высота <input v-model.number="resizeHeight" type="number" min="2" /></label>
            <button @click="applyResize">Применить размер</button>
          </div>
        </div>

        <div class="grid" :style="{ gridTemplateColumns: `repeat(${world.data.width}, 1fr)` }">
          <button
            v-for="(cell, index) in world.data.paint.flat()"
            :key="index"
            class="cell"
            :class="{
              painted: cell,
              robot: world.data.robot.x === index % world.data.width && world.data.robot.y === Math.floor(index / world.data.width),
              'tool-vwall': isEditMode && activeTool === 'vwall',
              'tool-hwall': isEditMode && activeTool === 'hwall'
            }"
            :style="{
              borderTopWidth: world.data.hWalls[Math.floor(index / world.data.width)][index % world.data.width] ? '3px' : '1px',
              borderBottomWidth: world.data.hWalls[Math.floor(index / world.data.width) + 1][index % world.data.width] ? '3px' : '1px',
              borderLeftWidth: world.data.vWalls[Math.floor(index / world.data.width)][index % world.data.width] ? '3px' : '1px',
              borderRightWidth: world.data.vWalls[Math.floor(index / world.data.width)][(index % world.data.width) + 1] ? '3px' : '1px'
            }"
            @click="onCellAction(index % world.data.width, Math.floor(index / world.data.width))"
            @mouseenter="onCellEnter(index % world.data.width, Math.floor(index / world.data.width))"
          >
            <span class="coords">{{ cellLabel(index % world.data.width, Math.floor(index / world.data.width)) }}</span>
            <span
              v-if="world.data.robot.x === index % world.data.width && world.data.robot.y === Math.floor(index / world.data.width)"
              class="robot-icon"
              @mousedown.stop="startRobotDrag"
            >🤖</span>
            <span
              class="wall-toggle wall-v"
              @click.stop="toggleVerticalWall((index % world.data.width) + 1, Math.floor(index / world.data.width))"
            />
            <span
              class="wall-toggle wall-h"
              @click.stop="toggleHorizontalWall(index % world.data.width, Math.floor(index / world.data.width) + 1)"
            />
          </button>
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
.grid { display: grid; gap: 6px; }
.cell { min-height: 72px; border-radius: 14px; border-style: solid; border-color: #27406f; background: #13203f; color: #9bb8ef; position: relative; overflow: hidden; }
.coords { font-size: 12px; opacity: 0.75; }
.cell.painted { background: linear-gradient(135deg, #f472b6, #8b5cf6); color: white; }
.cell.robot { box-shadow: inset 0 0 0 2px #f8fafc; }
.robot-icon { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font-size: 28px; cursor: grab; user-select: none; }
.wall-toggle { position: absolute; background: rgba(248, 250, 252, 0.1); opacity: 0; transition: opacity .15s ease; }
.cell.tool-vwall .wall-v,
.cell.tool-hwall .wall-h { opacity: 1; }
.wall-v { right: -1px; top: 0; width: 12px; height: 100%; cursor: col-resize; }
.wall-h { left: 0; bottom: -1px; width: 100%; height: 12px; cursor: row-resize; }
.edit-tools { display: grid; gap: 10px; margin-bottom: 12px; }
.tool-group { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.tool-group button.active { border-color: #8b5cf6; box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.25); }
.resize-controls label { display: inline-flex; align-items: center; gap: 6px; }
.resize-controls input { width: 72px; background: #09101f; color: #dce9ff; border: 1px solid #22345f; border-radius: 8px; padding: 4px 8px; }
.errors { color: #fca5a5; }
.console-panel pre { white-space: pre-wrap; margin: 0; background: #09101f; border-radius: 12px; padding: 16px; }
@media (max-width: 900px) { main, header { grid-template-columns: 1fr; } }
</style>
