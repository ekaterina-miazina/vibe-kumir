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
const logs = ref<string[]>(['VibeKumir готов — создано с vibe-coding ✨'])
const errors = ref<string[]>([])

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
  logs.value = ['Мир сброшен.']
  errors.value = []
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
        <p>Клиентская robot IDE, созданная с vibe-coding.</p>
      </div>
      <div class="toolbar">
        <select @change="loadExample(($event.target as HTMLSelectElement).value as keyof typeof examples)">
          <option value="line">Пример: линия</option>
          <option value="wall">Пример: до стены</option>
        </select>
        <button @click="run">Run</button>
        <button @click="reset">Reset</button>
      </div>
    </header>

    <main>
      <section class="panel">
        <h2>Code editor</h2>
        <textarea v-model="code" spellcheck="false" />
        <ul v-if="parseErrors.length" class="errors">
          <li v-for="error in parseErrors" :key="error">{{ error }}</li>
        </ul>
      </section>

      <section class="panel">
        <h2>Robot field</h2>
        <div class="grid" :style="{ gridTemplateColumns: `repeat(${world.data.width}, 1fr)` }">
          <button
            v-for="(cell, index) in world.data.paint.flat()"
            :key="index"
            class="cell"
            :class="{ painted: cell, robot: world.data.robot.x === index % world.data.width && world.data.robot.y === Math.floor(index / world.data.width) }"
            @click="world.togglePaint(index % world.data.width, Math.floor(index / world.data.width))"
            @dblclick="world.setRobot(index % world.data.width, Math.floor(index / world.data.width))"
          >
            {{ cellLabel(index % world.data.width, Math.floor(index / world.data.width)) }}
          </button>
        </div>
      </section>
    </main>

    <section class="panel console-panel">
      <h2>Console</h2>
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
.toolbar { display: flex; gap: 12px; align-items: center; }
main { grid-template-columns: minmax(320px, 1.1fr) minmax(320px, 1fr); }
.panel { background: rgba(16, 23, 47, 0.92); border: 1px solid rgba(145, 190, 255, 0.18); border-radius: 20px; padding: 20px; box-shadow: 0 16px 40px rgba(0,0,0,.25); }
textarea { width: 100%; min-height: 420px; background: #09101f; color: #dce9ff; border: 1px solid #22345f; border-radius: 14px; padding: 16px; resize: vertical; }
.grid { display: grid; gap: 6px; }
.cell { min-height: 72px; border-radius: 14px; border: 1px solid #27406f; background: #13203f; color: #9bb8ef; }
.cell.painted { background: linear-gradient(135deg, #f472b6, #8b5cf6); color: white; }
.cell.robot { outline: 3px solid #f8fafc; }
.errors { color: #fca5a5; }
.console-panel pre { white-space: pre-wrap; margin: 0; background: #09101f; border-radius: 12px; padding: 16px; }
@media (max-width: 900px) { main, header { grid-template-columns: 1fr; } }
</style>
