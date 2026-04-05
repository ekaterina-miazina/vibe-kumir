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
  | { kind: 'move'; direction: Direction; line: number }
  | { kind: 'paint'; line: number }
  | { kind: 'if'; condition: Expression; thenBranch: Statement[]; elseBranch: Statement[]; line: number }
  | { kind: 'repeat'; count: number; body: Statement[]; line: number }
  | { kind: 'while'; condition: Expression; body: Statement[]; line: number }

export interface Program {
  algorithmName: string
  statements: Statement[]
}
