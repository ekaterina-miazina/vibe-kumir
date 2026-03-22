export type Direction = 'up' | 'down' | 'left' | 'right'
export type RobotPredicate =
  | 'topFree' | 'bottomFree' | 'leftFree' | 'rightFree'
  | 'topWall' | 'bottomWall' | 'leftWall' | 'rightWall'
  | 'cellPainted' | 'cellClear'

export type Expression =
  | { kind: 'predicate'; predicate: RobotPredicate }
  | { kind: 'not'; value: Expression }
  | { kind: 'binary'; op: 'and' | 'or'; left: Expression; right: Expression }

export type Statement =
  | { kind: 'move'; direction: Direction }
  | { kind: 'paint' }
  | { kind: 'if'; condition: Expression; thenBranch: Statement[]; elseBranch: Statement[] }
  | { kind: 'repeat'; count: number; body: Statement[] }
  | { kind: 'while'; condition: Expression; body: Statement[] }

export interface Program {
  algorithmName: string
  statements: Statement[]
}
