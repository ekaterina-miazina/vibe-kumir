import { describe, expect, it } from 'vitest'
import { applyEnterIndentation, applyTabIndentation } from '@/editor/indentation'

describe('editor indentation', () => {
  it('adds one level of indent after a block opener on enter', () => {
    const source = `использовать Робот
алг test
нач`

    const result = applyEnterIndentation(source, source.length, source.length)

    expect(result.value).toBe(`использовать Робот
алг test
нач
  `)
    expect(result.selectionStart).toBe(result.value.length)
    expect(result.selectionEnd).toBe(result.value.length)
  })

  it('keeps the current indent after a closing keyword', () => {
    const source = `использовать Робот
алг test
нач
  если клетка чистая то
    закрасить
  все`

    const result = applyEnterIndentation(source, source.length, source.length)

    expect(result.value).toBe(`использовать Робот
алг test
нач
  если клетка чистая то
    закрасить
  все
  `)
  })

  it('realigns a closing keyword before inserting the next line', () => {
    const source = `использовать Робот
алг test
нач
  если клетка чистая то
    закрасить
    все`

    const result = applyEnterIndentation(source, source.length, source.length)

    expect(result.value).toBe(`использовать Робот
алг test
нач
  если клетка чистая то
    закрасить
  все
  `)
  })

  it('inserts spaces on tab and removes one indent level on shift+tab', () => {
    const tabbed = applyTabIndentation('закрасить', 0, 0)
    expect(tabbed.value).toBe('  закрасить')
    expect(tabbed.selectionStart).toBe(2)

    const untabbed = applyTabIndentation('  закрасить', 4, 4, true)
    expect(untabbed.value).toBe('закрасить')
    expect(untabbed.selectionStart).toBe(2)
  })

  it('indents every selected line', () => {
    const source = `если клетка чистая то
закрасить
все`

    const result = applyTabIndentation(source, 0, source.length)

    expect(result.value).toBe(`  если клетка чистая то
  закрасить
  все`)
    expect(result.selectionStart).toBe(2)
    expect(result.selectionEnd).toBe(result.value.length)
  })
})
