import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { currentUser } from "@/lib/guard";
import { logoutAction } from "@/app/actions";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "MCFC London Ballots" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const pending = user?.role === "ADMIN" ? await db.user.count({ where: { status: "PENDING" } }) : 0;
  return (
    <html lang="en-GB">
      <body>
        <header className="bg-navy text-white">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="font-bold">
              <span className="text-sky">MCFC</span> London Ballots
            </Link>
            {user && (
              <nav className="flex flex-1 flex-wrap items-center gap-4 text-sm">
                <Link href="/" className="hover:text-sky">Calendar</Link>
                <Link href="/me" className="hover:text-sky">My ballots</Link>
                <Link href="/group" className="hover:text-sky">My group</Link>
                {user.role === "ADMIN" && (
                  <>
                    <Link href="/admin" className="hover:text-sky">Games</Link>
                    <Link href="/admin/users" className="hover:text-sky">
                      Users{pending > 0 && <span className="ml-1 rounded-full bg-sky px-1.5 text-xs font-bold text-navy">{pending}</span>}
                    </Link>
                    <Link href="/admin/settings" className="hover:text-sky">Settings</Link>
                  </>
                )}
                <form action={logoutAction} className="ml-auto flex items-center gap-3">
                  <span className="text-slate-300">{user.name}</span>
                  <button className="rounded border border-white/30 px-2 py-1 hover:bg-white/10">Sign out</button>
                </form>
              </nav>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
