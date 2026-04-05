<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'

const emit = defineEmits<{
  openMain: []
}>()

const languageSections = [
  {
    title: 'Структура программы',
    items: [
      '`использовать Робот` подключает исполнителя.',
      '`алг <имя>` задаёт имя алгоритма.',
      '`нач` открывает тело программы, `кон` завершает его.',
    ],
  },
  {
    title: 'Команды робота',
    items: [
      '`вверх`, `вниз`, `влево`, `вправо` перемещают робота на одну клетку.',
      '`закрасить` закрашивает текущую клетку.',
    ],
  },
  {
    title: 'Условия',
    items: [
      'Проверки прохода: `сверху свободно`, `снизу свободно`, `слева свободно`, `справа свободно`.',
      'Проверки стен: `сверху стена`, `снизу стена`, `слева стена`, `справа стена`.',
      'Проверки клетки: `клетка закрашена`, `клетка чистая`.',
      'Логика: `не`, `и`, `или`.',
    ],
  },
  {
    title: 'Управляющие конструкции',
    items: [
      '`если <условие> то ... все` выполняет ветку по условию.',
      '`если <условие> то ... иначе ... все` поддерживает альтернативную ветку.',
      '`нц N раз ... кц` повторяет блок фиксированное число раз.',
      '`нц пока <условие> ... кц` повторяет блок, пока условие истинно.',
    ],
  },
]

const programExamples = [
  {
    id: 'paint-line',
    title: 'Линия из закрашенных клеток',
    description: 'Робот закрашивает стартовую клетку и ещё три клетки справа.',
    code: `использовать Робот
алг линия
нач
  нц 4 раз
    закрасить
    если справа свободно то
      вправо
    все
  кц
кон`,
  },
  {
    id: 'move-to-wall',
    title: 'Движение до стены',
    description: 'Робот идёт вправо, пока справа нет стены.',
    code: `использовать Робот
алг до_стены
нач
  нц пока справа свободно
    вправо
  кц
кон`,
  },
  {
    id: 'branch-paint',
    title: 'Ветвление с иначе',
    description: 'Если клетка уже закрашена, робот уходит вниз, иначе закрашивает её.',
    code: `использовать Робот
алг проверка_клетки
нач
  если клетка закрашена то
    вниз
  иначе
    закрасить
  все
кон`,
  },
  {
    id: 'square-step',
    title: 'Повторяющийся обход',
    description: 'Короткий цикл: робот дважды делает шаг и закрашивает клетку.',
    code: `использовать Робот
алг два_шага
нач
  нц 2 раз
    вправо
    закрасить
  кц
кон`,
  },
  {
    id: 'logic-condition',
    title: 'Логические условия',
    description: 'Робот двигается вправо, только если путь свободен и клетка ещё не закрашена.',
    code: `использовать Робот
алг логика
нач
  нц пока справа свободно и не клетка закрашена
    закрасить
    вправо
  кц
кон`,
  },
] as const

const copyStates = ref<Record<string, 'idle' | 'success' | 'error'>>({})
const resetTimers = new Map<string, number>()

onBeforeUnmount(() => {
  for (const timerId of resetTimers.values()) {
    window.clearTimeout(timerId)
  }
})

async function copyExample(id: string, code: string) {
  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error('clipboard unavailable')
    }

    await navigator.clipboard.writeText(code)
    setCopyState(id, 'success')
  } catch {
    setCopyState(id, 'error')
  }
}

function setCopyState(id: string, state: 'success' | 'error') {
  copyStates.value = { ...copyStates.value, [id]: state }
  const existingTimer = resetTimers.get(id)
  if (existingTimer) {
    window.clearTimeout(existingTimer)
  }

  const timerId = window.setTimeout(() => {
    copyStates.value = { ...copyStates.value, [id]: 'idle' }
    resetTimers.delete(id)
  }, 2000)

  resetTimers.set(id, timerId)
}

function copyButtonLabel(id: string) {
  const state = copyStates.value[id] ?? 'idle'
  if (state === 'success') return 'Скопировано'
  if (state === 'error') return 'Ошибка копирования'
  return 'Копировать'
}
</script>

<template>
  <div class="docs-shell">
    <header class="docs-header panel">
      <div>
        <h1>Документация по языку</h1>
        <p>
          Краткая справка по поддерживаемым инструкциям ВайбКумир и примеры мини-программ для быстрого старта.
        </p>
      </div>
      <a
        href="/"
        class="docs-link"
        data-testid="back-to-main-link"
        @click.prevent="emit('openMain')"
      >
        Вернуться в программу
      </a>
    </header>

    <main class="docs-layout">
      <section class="panel">
        <h2>Поддерживаемые инструкции</h2>
        <div class="docs-sections">
          <article v-for="section in languageSections" :key="section.title" class="docs-card">
            <h3>{{ section.title }}</h3>
            <ul>
              <li v-for="item in section.items" :key="item" v-html="item" />
            </ul>
          </article>
        </div>
      </section>

      <section class="panel">
        <h2>Примеры программ</h2>
        <div class="example-list">
          <article
            v-for="example in programExamples"
            :key="example.id"
            class="example-card"
            :data-testid="`docs-example-${example.id}`"
          >
            <div class="example-head">
              <div>
                <h3>{{ example.title }}</h3>
                <p>{{ example.description }}</p>
              </div>
              <button
                type="button"
                class="copy-button"
                :data-testid="`copy-example-${example.id}`"
                @click="copyExample(example.id, example.code)"
              >
                {{ copyButtonLabel(example.id) }}
              </button>
            </div>
            <pre>{{ example.code }}</pre>
          </article>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.docs-shell {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
  display: grid;
  gap: 20px;
}

.panel {
  background: var(--panel-background);
  border: 1px solid var(--panel-border);
  border-radius: 20px;
  padding: 20px;
  box-shadow: var(--panel-shadow);
  backdrop-filter: blur(18px);
}

.docs-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  align-items: start;
}

.docs-header h1 {
  margin: 0;
  font-size: clamp(2rem, 2.8vw, 2.8rem);
}

.docs-header p {
  margin: 8px 0 0;
  color: var(--muted-text);
  max-width: 72ch;
}

.docs-link,
.copy-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid var(--control-border);
  background: var(--control-background);
  color: var(--control-text);
  text-decoration: none;
  transition:
    background 0.16s ease,
    border-color 0.16s ease,
    color 0.16s ease,
    box-shadow 0.16s ease;
}

.copy-button {
  cursor: pointer;
  font: inherit;
}

.docs-link:hover,
.copy-button:hover {
  background: var(--control-background-hover);
  border-color: var(--control-border-strong);
}

.docs-link:focus-visible,
.copy-button:focus-visible {
  outline: none;
  border-color: var(--control-border-strong);
  box-shadow: 0 0 0 3px var(--control-focus-ring);
}

.docs-layout {
  display: grid;
  gap: 20px;
}

.docs-sections,
.example-list {
  display: grid;
  gap: 16px;
}

.docs-card {
  border: 1px solid var(--panel-border);
  border-radius: 16px;
  padding: 16px;
  background: color-mix(in srgb, var(--panel-background) 82%, transparent);
}

.docs-card h3,
.example-card h3,
.panel h2 {
  margin: 0 0 12px;
}

.docs-card ul {
  margin: 0;
  padding-left: 18px;
}

.docs-card li + li {
  margin-top: 8px;
}

.example-card {
  border: 1px solid var(--panel-border);
  border-radius: 16px;
  padding: 16px;
  background: color-mix(in srgb, var(--panel-background) 82%, transparent);
}

.example-head {
  display: flex;
  gap: 12px;
  justify-content: space-between;
  align-items: start;
  margin-bottom: 12px;
}

.example-head p {
  margin: 0;
  color: var(--muted-text);
  max-width: 62ch;
}

.example-card pre {
  margin: 0;
  padding: 16px;
  border-radius: 14px;
  background: var(--console-background);
  overflow: auto;
  font: 15px/1.5 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
}

@media (max-width: 900px) {
  .docs-header,
  .example-head {
    grid-template-columns: 1fr;
    display: grid;
  }
}
</style>
