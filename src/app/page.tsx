import { redirect } from "next/navigation"

// The app has no standalone marketing home yet. Send everyone to /today;
// middleware will bounce unauthenticated users to /login.
export default function Home() {
  redirect("/today")
}
