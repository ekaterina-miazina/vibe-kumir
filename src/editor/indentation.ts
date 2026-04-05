const indentUnit = '  '

interface TextEdit {
  start: number
  deleteCount: number
  insertText: string
}

export interface EditorEditResult {
  value: string
  selectionStart: number
  selectionEnd: number
}

export function applyEnterIndentation(
  source: string,
  selectionStart: number,
  selectionEnd: number,
): EditorEditResult {
  const lineStart = findLineStart(source, selectionStart)
  const lineEnd = findLineEnd(source, selectionStart)
  const currentLine = source.slice(lineStart, lineEnd)
  const beforeCursor = source.slice(lineStart, selectionStart)
  const lines = source.split('\n')
  const lineIndex = source.slice(0, lineStart).split('\n').length - 1
  const currentLineText = currentLine.trim()
  const currentLineNormalized = normalizeKeywordText(currentLineText)
  const expectedCurrentIndent = indentUnit.repeat(getExpectedIndentLevel(lines, lineIndex))
  const currentIndent = getLeadingWhitespace(currentLine)
  const shouldAlignCurrentLine = (
    selectionStart === selectionEnd
    && selectionStart === lineEnd
    && isDedentingKeyword(currentLineNormalized)
  )
  const effectiveCurrentIndent = shouldAlignCurrentLine ? expectedCurrentIndent : currentIndent
  const nextIndent = `${effectiveCurrentIndent}${
    shouldIncreaseIndent(beforeCursor.trimEnd()) ? indentUnit : ''
  }`
  const edits: TextEdit[] = []

  if (shouldAlignCurrentLine && currentIndent !== expectedCurrentIndent) {
    edits.push({
      start: lineStart,
      deleteCount: currentIndent.length,
      insertText: expectedCurrentIndent,
    })
  }

  edits.push({
    start: selectionStart,
    deleteCount: selectionEnd - selectionStart,
    insertText: `\n${nextIndent}`,
  })

  return applyTextEdits(source, edits, selectionStart, selectionStart)
}

export function applyTabIndentation(
  source: string,
  selectionStart: number,
  selectionEnd: number,
  reverse = false,
): EditorEditResult {
  if (selectionStart === selectionEnd) {
    return reverse
      ? outdentCurrentLine(source, selectionStart)
      : applyTextEdits(source, [{
        start: selectionStart,
        deleteCount: 0,
        insertText: indentUnit,
      }], selectionStart, selectionEnd)
  }

  const edits = getSelectedLineStarts(source, selectionStart, selectionEnd)
    .map((lineStart) => reverse ? createOutdentEdit(source, lineStart) : createIndentEdit(lineStart))
    .filter((edit): edit is TextEdit => edit !== null)

  if (edits.length === 0) {
    return { value: source, selectionStart, selectionEnd }
  }

  return applyTextEdits(source, edits, selectionStart, selectionEnd)
}

function outdentCurrentLine(source: string, selectionStart: number) {
  const lineStart = findLineStart(source, selectionStart)
  const edit = createOutdentEdit(source, lineStart)
  if (!edit) {
    return { value: source, selectionStart, selectionEnd: selectionStart }
  }

  return applyTextEdits(source, [edit], selectionStart, selectionStart)
}

function createIndentEdit(start: number): TextEdit {
  return {
    start,
    deleteCount: 0,
    insertText: indentUnit,
  }
}

function createOutdentEdit(source: string, lineStart: number): TextEdit | null {
  const lineEnd = findLineEnd(source, lineStart)
  const line = source.slice(lineStart, lineEnd)
  const removableSpaces = Math.min(indentUnit.length, countLeadingSpaces(line))

  if (removableSpaces === 0) {
    return null
  }

  return {
    start: lineStart,
    deleteCount: removableSpaces,
    insertText: '',
  }
}

function getSelectedLineStarts(source: string, selectionStart: number, selectionEnd: number) {
  const lineStarts: number[] = []
  let cursor = findLineStart(source, selectionStart)
  const lastSelectedIndex = selectionEnd > selectionStart && source[selectionEnd - 1] === '\n'
    ? selectionEnd - 1
    : selectionEnd
  const blockEnd = findLineEnd(source, lastSelectedIndex)

  while (cursor <= blockEnd) {
    lineStarts.push(cursor)
    const lineEnd = findLineEnd(source, cursor)
    if (lineEnd >= source.length) break
    cursor = lineEnd + 1
  }

  return lineStarts
}

function shouldIncreaseIndent(text: string) {
  const normalized = normalizeKeywordText(text.trim())
  if (!normalized) return false

  return normalized === 'нач'
    || normalized === 'иначе'
    || (normalized.startsWith('если ') && normalized.endsWith(' то'))
    || /^нц\s+\d+\s+раз$/.test(normalized)
    || /^нц\s+пока\s+.+$/.test(normalized)
}

function isDedentingKeyword(text: string) {
  return text === 'иначе' || text === 'все' || text === 'кц' || text === 'кон'
}

function getExpectedIndentLevel(lines: string[], lineIndex: number) {
  let nextLevel = 0

  for (let index = 0; index < lineIndex; index += 1) {
    const normalized = normalizeKeywordText(lines[index].trim())
    if (!normalized) continue

    const currentLevel = isDedentingKeyword(normalized)
      ? Math.max(0, nextLevel - 1)
      : nextLevel

    nextLevel = shouldIncreaseIndent(normalized) ? currentLevel + 1 : currentLevel
  }

  const currentNormalized = normalizeKeywordText(lines[lineIndex]?.trim() ?? '')
  return isDedentingKeyword(currentNormalized)
    ? Math.max(0, nextLevel - 1)
    : nextLevel
}

function getLeadingWhitespace(text: string) {
  return text.match(/^\s*/)?.[0] ?? ''
}

function countLeadingSpaces(text: string) {
  return text.match(/^ */)?.[0].length ?? 0
}

function normalizeKeywordText(text: string) {
  return text.toLocaleLowerCase('ru-RU')
}

function findLineStart(source: string, index: number) {
  const boundedIndex = Math.max(0, Math.min(index, source.length))
  const newlineIndex = source.lastIndexOf('\n', Math.max(0, boundedIndex - 1))
  return newlineIndex === -1 ? 0 : newlineIndex + 1
}

function findLineEnd(source: string, index: number) {
  const boundedIndex = Math.max(0, Math.min(index, source.length))
  const newlineIndex = source.indexOf('\n', boundedIndex)
  return newlineIndex === -1 ? source.length : newlineIndex
}

function applyTextEdits(
  source: string,
  edits: TextEdit[],
  selectionStart: number,
  selectionEnd: number,
): EditorEditResult {
  let cursor = 0
  let value = ''

  for (const edit of edits) {
    value += source.slice(cursor, edit.start)
    value += edit.insertText
    cursor = edit.start + edit.deleteCount
  }

  value += source.slice(cursor)

  return {
    value,
    selectionStart: mapPosition(selectionStart, edits),
    selectionEnd: mapPosition(selectionEnd, edits),
  }
}

function mapPosition(position: number, edits: TextEdit[]) {
  let mappedPosition = position

  for (const edit of edits) {
    const replacedRangeEnd = edit.start + edit.deleteCount
    const insertedLength = edit.insertText.length

    if (position < edit.start) continue
    if (position === edit.start) {
      mappedPosition += insertedLength
      continue
    }
    if (position < replacedRangeEnd) {
      return edit.start + insertedLength
    }

    mappedPosition += insertedLength - edit.deleteCount
  }

  return mappedPosition
}
