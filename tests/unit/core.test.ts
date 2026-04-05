import { describe, expect, it } from 'vitest'
import { parseProgram } from '@/core/language/parser'
import { runProgram } from '@/core/runtime/interpreter'
import { RobotWorld } from '@/core/robot/world'

describe('parser', () => {
  it('parses repeat and conditionals', () => {
    const source = `использовать Робот
алг test
нач
  нц 2 раз
    если клетка чистая то
      закрасить
    все
  кц
кон`
    const result = parseProgram(source)
    expect(result.errors).toEqual([])
    expect(result.program?.statements).toHaveLength(1)
    expect(result.program?.statements[0].line).toBe(4)
  })

  it('reports source line for unknown command even with blank lines', () => {
    const invalidLine = '  прыжок'
    const result = parseProgram(`использовать Робот
алг test
нач

  закрасить
  прыжок
кон`)

    expect(result.errors).toEqual([{
      message: 'Неизвестная команда: прыжок',
      line: 6,
      startOffset: invalidLine.indexOf('прыжок'),
      endOffset: invalidLine.indexOf('прыжок') + 'прыжок'.length,
    }])
  })

  it('reports control structure line when closing word is missing', () => {
    const openingLine = '  если клетка чистая то'
    const result = parseProgram(`использовать Робот
алг test
нач
  если клетка чистая то
    закрасить
кон`)

    expect(result.errors).toEqual([{
      message: 'Ожидалось слово "все".',
      line: 4,
      startOffset: openingLine.indexOf('если'),
      endOffset: openingLine.length,
    }])
  })

  it('reports the exact condition range for unknown predicates', () => {
    const openingLine = '  если не телепорт то'
    const condition = 'не телепорт'
    const invalidFragment = 'телепорт'
    const result = parseProgram(`использовать Робот
алг test
нач
  если не телепорт то
    закрасить
  все
кон`)

    expect(result.errors).toEqual([{
      message: `Неизвестное условие: ${condition}`,
      line: 4,
      startOffset: openingLine.indexOf(invalidFragment),
      endOffset: openingLine.indexOf(invalidFragment) + invalidFragment.length,
    }])
  })

  it('reports loop opening line when closing word is missing', () => {
    const openingLine = '  нц 2 раз'
    const result = parseProgram(`использовать Робот
алг test
нач
  нц 2 раз
    закрасить
кон`)

    expect(result.errors).toEqual([{
      message: 'Ожидалось слово "кц".',
      line: 4,
      startOffset: openingLine.indexOf('нц'),
      endOffset: openingLine.length,
    }])
  })
})

describe('runtime', () => {
  it('reports collision and keeps robot in place', () => {
    const world = RobotWorld.create(2, 1)
    world.toggleVerticalWall(1, 0)
    const program = parseProgram(`использовать Робот
алг test
нач
  вправо
кон`).program!
    const events = runProgram(program, world)
    expect(events[events.length - 1]).toEqual({ type: 'runtimeError', message: 'collision with obstacle', line: 4 })
    expect(world.data.robot).toEqual({ x: 0, y: 0 })
  })

  it('paints a clear cell through predicate', () => {
    const world = RobotWorld.create(1, 1)
    const program = parseProgram(`использовать Робот
алг test
нач
  если клетка чистая то
    закрасить
  все
кон`).program!
    const events = runProgram(program, world)
    expect(events.some((event) => event.type === 'painted')).toBe(true)
    expect(world.isCellPainted()).toBe(true)
  })

  it('reports the concrete statement line inside loops', () => {
    const world = RobotWorld.create(2, 1)
    world.toggleVerticalWall(1, 0)
    const program = parseProgram(`использовать Робот
алг test
нач
  нц 2 раз
    вправо
  кц
кон`).program!

    const events = runProgram(program, world)

    expect(events[events.length - 1]).toEqual({ type: 'runtimeError', message: 'collision with obstacle', line: 5 })
  })
})
