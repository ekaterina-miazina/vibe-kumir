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
  rawText: string
  text: string
  normalizedText: string
  line: number
  contentStart: number
}

export interface ParseDiagnostic {
  message: string
  line?: number
  startOffset?: number
  endOffset?: number
}

export interface ParseResult {
  program?: Program
  errors: ParseDiagnostic[]
}

interface SourceRange {
  startOffset: number
  endOffset: number
}

type ExpressionParseResult =
  | { expression: Expression }
  | { errorRange: SourceRange }

export function parseProgram(source: string): ParseResult {
  const lines = source
    .split('\n')
    .map((rawText, index) => createSourceLine(rawText, index + 1))

  const start = lines.findIndex((line) => line.normalizedText.startsWith('алг '))
  const begin = lines.findIndex((line) => line.normalizedText === 'нач')
  const end = findLastLineIndex(lines, 'кон')

  if (start === -1 || begin === -1 || end === -1 || end <= begin) {
    return { errors: [{ message: 'Ожидался блок "алг ... нач ... кон".' }] }
  }

  const algorithmName = lines[start].text.slice(4).trim() || 'без_имени'
  const body = lines.slice(begin + 1, end)
  const [statements, nextIndex, errors] = parseBlock(body, 0, new Set())

  if (errors.length > 0) return { errors }
  if (nextIndex !== body.length) {
    return { errors: [createDiagnostic('Не удалось разобрать программу до конца.', body[nextIndex])] }
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
    if (stopWords.has(sourceLine.normalizedText)) break

    if (sourceLine.normalizedText === 'закрасить') {
      statements.push({ kind: 'paint', line: sourceLine.line })
      index += 1
      continue
    }

    const direction = parseDirection(sourceLine.normalizedText)
    if (direction) {
      statements.push({ kind: 'move', direction, line: sourceLine.line })
      index += 1
      continue
    }

    if (sourceLine.normalizedText.startsWith('если ') && sourceLine.normalizedText.endsWith(' то')) {
      const conditionText = sourceLine.text.slice(5, -3).trim()
      const condition = parseExpression(conditionText)
      if ('errorRange' in condition) {
        const conditionStart = sourceLine.text.indexOf(conditionText, 5)
        return [statements, index, [createDiagnostic(
          `Неизвестное условие: ${conditionText}`,
          sourceLine,
          conditionStart + condition.errorRange.startOffset,
          conditionStart + condition.errorRange.endOffset,
        )]]
      }
      const [thenBranch, thenIndex, thenErrors] = parseBlock(lines, index + 1, new Set(['иначе', 'все']))
      if (thenErrors.length > 0) return [statements, thenIndex, thenErrors]
      let elseBranch: Statement[] = []
      let cursor = thenIndex
      if (lines[cursor]?.normalizedText === 'иначе') {
        const [parsedElse, elseIndex, elseErrors] = parseBlock(lines, cursor + 1, new Set(['все']))
        if (elseErrors.length > 0) return [statements, elseIndex, elseErrors]
        elseBranch = parsedElse
        cursor = elseIndex
      }
      if (lines[cursor]?.normalizedText !== 'все') {
        return [statements, cursor, [createDiagnostic('Ожидалось слово "все".', sourceLine)]]
      }
      statements.push({ kind: 'if', condition: condition.expression, thenBranch, elseBranch, line: sourceLine.line })
      index = cursor + 1
      continue
    }

    const repeatMatch = sourceLine.normalizedText.match(/^нц\s+(\d+)\s+раз$/)
    if (repeatMatch) {
      const [body, next, bodyErrors] = parseBlock(lines, index + 1, new Set(['кц']))
      if (bodyErrors.length > 0) return [statements, next, bodyErrors]
      if (lines[next]?.normalizedText !== 'кц') {
        return [statements, next, [createDiagnostic('Ожидалось слово "кц".', sourceLine)]]
      }
      statements.push({ kind: 'repeat', count: Number(repeatMatch[1]), body, line: sourceLine.line })
      index = next + 1
      continue
    }

    const whileMatch = sourceLine.normalizedText.match(/^нц\s+пока\s+(.+)$/)
    if (whileMatch) {
      const conditionText = sourceLine.text.slice('нц пока '.length).trim()
      const condition = parseExpression(conditionText)
      if ('errorRange' in condition) {
        const conditionStart = sourceLine.text.indexOf(conditionText, 'нц '.length)
        return [statements, index, [createDiagnostic(
          `Неизвестное условие: ${conditionText}`,
          sourceLine,
          conditionStart + condition.errorRange.startOffset,
          conditionStart + condition.errorRange.endOffset,
        )]]
      }
      const [body, next, bodyErrors] = parseBlock(lines, index + 1, new Set(['кц']))
      if (bodyErrors.length > 0) return [statements, next, bodyErrors]
      if (lines[next]?.normalizedText !== 'кц') {
        return [statements, next, [createDiagnostic('Ожидалось слово "кц".', sourceLine)]]
      }
      statements.push({ kind: 'while', condition: condition.expression, body, line: sourceLine.line })
      index = next + 1
      continue
    }

    return [statements, index, [createDiagnostic(`Неизвестная команда: ${sourceLine.text}`, sourceLine)]]
  }

  return [statements, index, errors]
}

function findLastLineIndex(lines: SourceLine[], value: string) {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index].normalizedText === value) return index
  }
  return -1
}

function createSourceLine(rawText: string, line: number): SourceLine {
  const text = rawText.trim()
  const firstNonWhitespace = rawText.search(/\S/)
  return {
    rawText,
    text,
    normalizedText: normalizeKeywordText(text),
    line,
    contentStart: firstNonWhitespace === -1 ? rawText.length : firstNonWhitespace,
  }
}

function createDiagnostic(
  message: string,
  sourceLine?: SourceLine,
  startOffset = 0,
  endOffset = sourceLine?.text.length ?? 0,
): ParseDiagnostic {
  if (!sourceLine) return { message }
  const range = toRawRange(sourceLine, { startOffset, endOffset })
  return { message, line: sourceLine.line, startOffset: range.startOffset, endOffset: range.endOffset }
}

function toRawRange(sourceLine: SourceLine, range: SourceRange): SourceRange {
  const startOffset = clamp(range.startOffset, 0, sourceLine.text.length)
  const endOffset = clamp(range.endOffset, startOffset, sourceLine.text.length)
  return {
    startOffset: sourceLine.contentStart + startOffset,
    endOffset: sourceLine.contentStart + endOffset,
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function parseDirection(line: string) {
  return ({ вверх: 'up', вниз: 'down', влево: 'left', вправо: 'right' } as const)[line]
}

function parseExpression(text: string): ExpressionParseResult {
  const normalized = normalizeKeywordText(text.trim())
  if (normalized.startsWith('не ')) {
    const value = parseExpression(normalized.slice(3))
    if ('errorRange' in value) {
      return { errorRange: shiftRange(value.errorRange, 3) }
    }
    return { expression: { kind: 'not', value: value.expression } }
  }

  for (const op of [' или ', ' и '] as const) {
    const idx = normalized.indexOf(op)
    if (idx !== -1) {
      const left = parseExpression(normalized.slice(0, idx))
      const right = parseExpression(normalized.slice(idx + op.length))
      if ('errorRange' in left) return { errorRange: left.errorRange }
      if ('errorRange' in right) {
        return { errorRange: shiftRange(right.errorRange, idx + op.length) }
      }
      return {
        expression: {
          kind: 'binary',
          op: op.trim() === 'и' ? 'and' : 'or',
          left: left.expression,
          right: right.expression,
        },
      }
    }
  }

  const predicate = predicateMap[normalized]
  return predicate
    ? { expression: { kind: 'predicate', predicate } }
    : { errorRange: { startOffset: 0, endOffset: normalized.length } }
}

function shiftRange(range: SourceRange, offset: number): SourceRange {
  return {
    startOffset: range.startOffset + offset,
    endOffset: range.endOffset + offset,
  }
}

function normalizeKeywordText(text: string) {
  return text.toLocaleLowerCase('ru-RU')
}
