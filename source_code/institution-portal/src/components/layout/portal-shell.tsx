"use client";

import { useAuthStore } from "@/lib/store";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
    LayoutDashboard,
    Briefcase,
    Ticket,
    Users,
    LogOut,
    Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/jobs", label: "Job Board", icon: Briefcase },
    { href: "/invites", label: "Invite Codes", icon: Ticket },
    { href: "/students", label: "Students", icon: Users },
];

export function PortalShell({ children }: { children: React.ReactNode }) {
    const { user, logout } = useAuthStore();
    const router = useRouter();
    const pathname = usePathname();

    const handleLogout = () => {
        logout();
        router.push("/login");
    };

    return (
        <div className="flex min-h-screen bg-slate-50">
            {/* Sidebar */}
            <aside className="hidden w-60 flex-col border-r border-slate-200 bg-white lg:flex">
                <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-6">
                    <Building2 className="h-5 w-5 text-indigo-600" />
                    <span className="font-semibold text-slate-900 tracking-tight">Institution TPO</span>
                </div>
                <nav className="flex flex-1 flex-col gap-1 p-4">
                    {NAV.map(({ href, label, icon: Icon }) => (
                        <Link
                            key={href}
                            href={href}
                            className={cn(
                                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                                pathname === href
                                    ? "bg-indigo-50 text-indigo-700"
                                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                            )}
                        >
                            <Icon className="h-4 w-4" />
                            {label}
                        </Link>
                    ))}
                </nav>
                <div className="border-t border-slate-200 p-4">
                    <div className="mb-3 px-3 text-xs text-slate-500 truncate">{user?.email}</div>
                    <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-rose-600 transition-colors"
                    >
                        <LogOut className="h-4 w-4" />
                        Sign out
                    </button>
                </div>
            </aside>

            {/* Main */}
            <div className="flex flex-1 flex-col">
                <header className="flex h-16 items-center border-b border-slate-200 bg-white px-6 lg:hidden">
                    <Building2 className="h-5 w-5 text-indigo-600" />
                    <span className="ml-2 font-semibold text-slate-900">Institution TPO</span>
                </header>
                <main className="flex-1 p-6 lg:p-8">{children}</main>
            </div>
        </div>
    );
}
