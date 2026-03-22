export interface RobotPosition { x: number; y: number }
export interface RobotWorldData {
  width: number
  height: number
  robot: RobotPosition
  paint: boolean[][]
  vWalls: boolean[][]
  hWalls: boolean[][]
}

export class RobotWorld {
  constructor(public data: RobotWorldData) {}

  static create(width: number, height: number): RobotWorld {
    return new RobotWorld({
      width,
      height,
      robot: { x: 0, y: 0 },
      paint: Array.from({ length: height }, () => Array.from({ length: width }, () => false)),
      vWalls: Array.from({ length: height }, () => Array.from({ length: width + 1 }, (_, i) => i === 0 || i === width)),
      hWalls: Array.from({ length: height + 1 }, (_, i) => Array.from({ length: width }, () => i === 0 || i === height)),
    })
  }

  clone() { return new RobotWorld(structuredClone(this.data)) }
  isCellPainted() { return this.data.paint[this.data.robot.y][this.data.robot.x] }
  paint() { this.data.paint[this.data.robot.y][this.data.robot.x] = true }
  togglePaint(x: number, y: number) { this.data.paint[y][x] = !this.data.paint[y][x] }
  setRobot(x: number, y: number) { this.data.robot = { x, y } }
  toggleVerticalWall(x: number, y: number) { if (x > 0 && x < this.data.width) this.data.vWalls[y][x] = !this.data.vWalls[y][x] }
  toggleHorizontalWall(x: number, y: number) { if (y > 0 && y < this.data.height) this.data.hWalls[y][x] = !this.data.hWalls[y][x] }
  isWallTop(x = this.data.robot.x, y = this.data.robot.y) { return this.data.hWalls[y][x] }
  isWallBottom(x = this.data.robot.x, y = this.data.robot.y) { return this.data.hWalls[y + 1][x] }
  isWallLeft(x = this.data.robot.x, y = this.data.robot.y) { return this.data.vWalls[y][x] }
  isWallRight(x = this.data.robot.x, y = this.data.robot.y) { return this.data.vWalls[y][x + 1] }
}
