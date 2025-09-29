import { listClasses } from '@/server/actions/classes'
import { listRooms } from '@/server/actions/rooms'
import { Editor } from '@/components/editor/Editor'

export default async function HomePage() {
  const [classes, rooms] = await Promise.all([listClasses(), listRooms()])
  const classesLite = classes.map(c => ({ id: c.id, name: c.name }))
  const roomsLite = rooms.map(r => ({ id: r.id, name: r.name, type: r.type }))
  return (
    <main className="h-[calc(100vh-48px)]">
      <Editor classes={classesLite} rooms={roomsLite} />
    </main>
  )
}
