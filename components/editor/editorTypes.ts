export type ElementType = 'STUDENT' | 'TEACHER_DESK' | 'DOOR' | 'WINDOW_SIDE' | 'WALL_SIDE'

export type Element = {
  id?: string
  type: ElementType
  refId?: string | null
  x: number
  y: number
  w: number
  h: number
  rotation: number
  z: number
  groupId?: string | null
  meta?: any
}

export type Plan = {
  id: string
  classId: string
  roomId: string
  // Optional name; null indicates the default (lead) plan
  title: string | null
  elements: Element[]
}
