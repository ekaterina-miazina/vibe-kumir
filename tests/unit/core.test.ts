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
    expect(events[events.length - 1]).toEqual({ type: 'runtimeError', message: 'collision with obstacle' })
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
})
