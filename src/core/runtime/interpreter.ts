import type { Expression, Program, Statement } from '../language/ast'
import { RobotWorld } from '../robot/world'

export type RuntimeEvent =
  | { type: 'moved'; position: { x: number; y: number } }
  | { type: 'painted'; position: { x: number; y: number } }
  | { type: 'runtimeError'; message: string }
  | { type: 'done' }

export class RuntimeError extends Error {}

export function runProgram(program: Program, world: RobotWorld, maxSteps = 1_000): RuntimeEvent[] {
  const events: RuntimeEvent[] = []
  let steps = 0

  const guard = () => {
    steps += 1
    if (steps > maxSteps) throw new RuntimeError('step budget exceeded')
  }

  const evalExpr = (expr: Expression): boolean => {
    switch (expr.kind) {
      case 'predicate':
        return evaluatePredicate(expr.predicate, world)
      case 'not':
        return !evalExpr(expr.value)
      case 'binary':
        return expr.op === 'and' ? evalExpr(expr.left) && evalExpr(expr.right) : evalExpr(expr.left) || evalExpr(expr.right)
    }
  }

  const exec = (statements: Statement[]) => {
    for (const statement of statements) {
      guard()
      switch (statement.kind) {
        case 'move':
          moveRobot(world, statement.direction)
          events.push({ type: 'moved', position: { ...world.data.robot } })
          break
        case 'paint':
          world.paint()
          events.push({ type: 'painted', position: { ...world.data.robot } })
          break
        case 'if':
          exec(evalExpr(statement.condition) ? statement.thenBranch : statement.elseBranch)
          break
        case 'repeat':
          for (let i = 0; i < statement.count; i += 1) exec(statement.body)
          break
        case 'while':
          while (evalExpr(statement.condition)) exec(statement.body)
          break
      }
    }
  }

  try {
    exec(program.statements)
    events.push({ type: 'done' })
  } catch (error) {
    events.push({ type: 'runtimeError', message: error instanceof Error ? error.message : 'unknown runtime error' })
  }

  return events
}

function moveRobot(world: RobotWorld, direction: 'up' | 'down' | 'left' | 'right') {
  const { x, y } = world.data.robot
  if (direction === 'up') {
    if (world.isWallTop()) throw new RuntimeError('collision with obstacle')
    world.setRobot(x, y - 1)
  } else if (direction === 'down') {
    if (world.isWallBottom()) throw new RuntimeError('collision with obstacle')
    world.setRobot(x, y + 1)
  } else if (direction === 'left') {
    if (world.isWallLeft()) throw new RuntimeError('collision with obstacle')
    world.setRobot(x - 1, y)
  } else {
    if (world.isWallRight()) throw new RuntimeError('collision with obstacle')
    world.setRobot(x + 1, y)
  }
}

function evaluatePredicate(predicate: import('../language/ast').RobotPredicate, world: RobotWorld): boolean {
  switch (predicate) {
    case 'topFree': return !world.isWallTop()
    case 'bottomFree': return !world.isWallBottom()
    case 'leftFree': return !world.isWallLeft()
    case 'rightFree': return !world.isWallRight()
    case 'topWall': return world.isWallTop()
    case 'bottomWall': return world.isWallBottom()
    case 'leftWall': return world.isWallLeft()
    case 'rightWall': return world.isWallRight()
    case 'cellPainted': return world.isCellPainted()
    case 'cellClear': return !world.isCellPainted()
    default: return false
  }
}

