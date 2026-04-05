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

interface SourceLine {
  text: string
  line: number
}

export interface ParseDiagnostic {
  message: string
  line?: number
}

export interface ParseResult {
  program?: Program
  errors: ParseDiagnostic[]
}

export function parseProgram(source: string): ParseResult {
  const lines = source
    .split('\n')
    .map((line, index) => ({ text: line.trim(), line: index + 1 }))

  const start = lines.findIndex((line) => line.text.startsWith('алг '))
  const begin = lines.findIndex((line) => line.text === 'нач')
  const end = findLastLineIndex(lines, 'кон')

  if (start === -1 || begin === -1 || end === -1 || end <= begin) {
    return { errors: [{ message: 'Ожидался блок "алг ... нач ... кон".' }] }
  }

  const algorithmName = lines[start].text.slice(4).trim() || 'без_имени'
  const body = lines.slice(begin + 1, end)
  const [statements, nextIndex, errors] = parseBlock(body, 0, new Set())

  if (errors.length > 0) return { errors }
  if (nextIndex !== body.length) {
    return { errors: [{ message: 'Не удалось разобрать программу до конца.', line: body[nextIndex]?.line }] }
  }

  return { program: { algorithmName, statements }, errors: [] }
}

function parseBlock(lines: SourceLine[], index: number, stopWords: Set<string>): [Statement[], number, ParseDiagnostic[]] {
  const statements: Statement[] = []
  const errors: ParseDiagnostic[] = []

  while (index < lines.length) {
    const sourceLine = lines[index]
    if (!sourceLine.text) {
      index += 1
      continue
    }
    if (stopWords.has(sourceLine.text)) break

    if (sourceLine.text === 'закрасить') {
      statements.push({ kind: 'paint', line: sourceLine.line })
      index += 1
      continue
    }

    const direction = parseDirection(sourceLine.text)
    if (direction) {
      statements.push({ kind: 'move', direction, line: sourceLine.line })
      index += 1
      continue
    }

    if (sourceLine.text.startsWith('если ') && sourceLine.text.endsWith(' то')) {
      const conditionText = sourceLine.text.slice(5, -3).trim()
      const condition = parseExpression(conditionText)
      if (!condition) return [statements, index, [{ message: `Неизвестное условие: ${conditionText}`, line: sourceLine.line }]]
      const [thenBranch, thenIndex, thenErrors] = parseBlock(lines, index + 1, new Set(['иначе', 'все']))
      if (thenErrors.length > 0) return [statements, thenIndex, thenErrors]
      let elseBranch: Statement[] = []
      let cursor = thenIndex
      if (lines[cursor]?.text === 'иначе') {
        const [parsedElse, elseIndex, elseErrors] = parseBlock(lines, cursor + 1, new Set(['все']))
        if (elseErrors.length > 0) return [statements, elseIndex, elseErrors]
        elseBranch = parsedElse
        cursor = elseIndex
      }
      if (lines[cursor]?.text !== 'все') {
        return [statements, cursor, [{ message: 'Ожидалось слово "все".', line: sourceLine.line }]]
      }
      statements.push({ kind: 'if', condition, thenBranch, elseBranch, line: sourceLine.line })
      index = cursor + 1
      continue
    }

    const repeatMatch = sourceLine.text.match(/^нц\s+(\d+)\s+раз$/)
    if (repeatMatch) {
      const [body, next, bodyErrors] = parseBlock(lines, index + 1, new Set(['кц']))
      if (bodyErrors.length > 0) return [statements, next, bodyErrors]
      if (lines[next]?.text !== 'кц') {
        return [statements, next, [{ message: 'Ожидалось слово "кц".', line: sourceLine.line }]]
      }
      statements.push({ kind: 'repeat', count: Number(repeatMatch[1]), body, line: sourceLine.line })
      index = next + 1
      continue
    }

    const whileMatch = sourceLine.text.match(/^нц\s+пока\s+(.+)$/)
    if (whileMatch) {
      const condition = parseExpression(whileMatch[1])
      if (!condition) return [statements, index, [{ message: `Неизвестное условие: ${whileMatch[1]}`, line: sourceLine.line }]]
      const [body, next, bodyErrors] = parseBlock(lines, index + 1, new Set(['кц']))
      if (bodyErrors.length > 0) return [statements, next, bodyErrors]
      if (lines[next]?.text !== 'кц') {
        return [statements, next, [{ message: 'Ожидалось слово "кц".', line: sourceLine.line }]]
      }
      statements.push({ kind: 'while', condition, body, line: sourceLine.line })
      index = next + 1
      continue
    }

    return [statements, index, [{ message: `Неизвестная команда: ${sourceLine.text}`, line: sourceLine.line }]]
  }

  return [statements, index, errors]
}

function findLastLineIndex(lines: SourceLine[], value: string) {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index].text === value) return index
  }
  return -1
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
