import type { Expression, Program, RobotPredicate, Statement } from './ast'

const predicateMap: Record<string, RobotPredicate> = {
  'сверху свободно': 'topFree',
  'снизу свободно': 'bottomFree',
  'слева свободно': 'leftFree',
  'справа свободно': 'rightFree',
  'сверху стена': 'topWall',
  'снизу стена': 'bottomWall',
  'слева стена': 'leftWall',
  'справа стена': 'rightWall',
  'клетка закрашена': 'cellPainted',
  'клетка чистая': 'cellClear',
}

export interface ParseResult {
  program?: Program
  errors: string[]
}

export function parseProgram(source: string): ParseResult {
  const cleaned = source
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const start = cleaned.findIndex((line) => line.startsWith('алг '))
  const begin = cleaned.findIndex((line) => line === 'нач')
  const end = cleaned.lastIndexOf('кон')

  if (start === -1 || begin === -1 || end === -1 || end <= begin) {
    return { errors: ['Ожидался блок "алг ... нач ... кон".'] }
  }

  const algorithmName = cleaned[start].slice(4).trim() || 'без_имени'
  const body = cleaned.slice(begin + 1, end)
  const [statements, nextIndex, errors] = parseBlock(body, 0, new Set())

  if (errors.length > 0) return { errors }
  if (nextIndex !== body.length) return { errors: ['Не удалось разобрать программу до конца.'] }

  return { program: { algorithmName, statements }, errors: [] }
}

function parseBlock(lines: string[], index: number, stopWords: Set<string>): [Statement[], number, string[]] {
  const statements: Statement[] = []
  const errors: string[] = []

  while (index < lines.length) {
    const line = lines[index]
    if (stopWords.has(line)) break

    if (line === 'закрасить') {
      statements.push({ kind: 'paint' })
      index += 1
      continue
    }

    const direction = parseDirection(line)
    if (direction) {
      statements.push({ kind: 'move', direction })
      index += 1
      continue
    }

    if (line.startsWith('если ') && line.endsWith(' то')) {
      const conditionText = line.slice(5, -3).trim()
      const condition = parseExpression(conditionText)
      if (!condition) return [statements, index, [`Неизвестное условие: ${conditionText}`]]
      const [thenBranch, thenIndex, thenErrors] = parseBlock(lines, index + 1, new Set(['иначе', 'все']))
      if (thenErrors.length > 0) return [statements, thenIndex, thenErrors]
      let elseBranch: Statement[] = []
      let cursor = thenIndex
      if (lines[cursor] === 'иначе') {
        const [parsedElse, elseIndex, elseErrors] = parseBlock(lines, cursor + 1, new Set(['все']))
        if (elseErrors.length > 0) return [statements, elseIndex, elseErrors]
        elseBranch = parsedElse
        cursor = elseIndex
      }
      if (lines[cursor] !== 'все') return [statements, cursor, ['Ожидалось слово "все".']]
      statements.push({ kind: 'if', condition, thenBranch, elseBranch })
      index = cursor + 1
      continue
    }

    const repeatMatch = line.match(/^нц\s+(\d+)\s+раз$/)
    if (repeatMatch) {
      const [body, next, bodyErrors] = parseBlock(lines, index + 1, new Set(['кц']))
      if (bodyErrors.length > 0) return [statements, next, bodyErrors]
      if (lines[next] !== 'кц') return [statements, next, ['Ожидалось слово "кц".']]
      statements.push({ kind: 'repeat', count: Number(repeatMatch[1]), body })
      index = next + 1
      continue
    }

    const whileMatch = line.match(/^нц\s+пока\s+(.+)$/)
    if (whileMatch) {
      const condition = parseExpression(whileMatch[1])
      if (!condition) return [statements, index, [`Неизвестное условие: ${whileMatch[1]}`]]
      const [body, next, bodyErrors] = parseBlock(lines, index + 1, new Set(['кц']))
      if (bodyErrors.length > 0) return [statements, next, bodyErrors]
      if (lines[next] !== 'кц') return [statements, next, ['Ожидалось слово "кц".']]
      statements.push({ kind: 'while', condition, body })
      index = next + 1
      continue
    }

    return [statements, index, [`Неизвестная команда: ${line}`]]
  }

  return [statements, index, errors]
}

function parseDirection(line: string) {
  return ({ вверх: 'up', вниз: 'down', влево: 'left', вправо: 'right' } as const)[line]
}

function parseExpression(text: string): Expression | null {
  const normalized = text.trim()
  if (normalized.startsWith('не ')) {
    const value = parseExpression(normalized.slice(3))
    return value ? { kind: 'not', value } : null
  }

  for (const op of [' или ', ' и '] as const) {
    const idx = normalized.indexOf(op)
    if (idx !== -1) {
      const left = parseExpression(normalized.slice(0, idx))
      const right = parseExpression(normalized.slice(idx + op.length))
      if (!left || !right) return null
      return { kind: 'binary', op: op.trim() === 'и' ? 'and' : 'or', left, right }
    }
  }

  const predicate = predicateMap[normalized]
  return predicate ? { kind: 'predicate', predicate } : null
}
