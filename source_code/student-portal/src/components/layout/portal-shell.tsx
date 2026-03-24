"use client";

import { useAuthStore } from "@/lib/store";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
    UserCircle,
    Briefcase,
    FileText,
    Activity,
    LogOut,
    GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
    { href: "/", label: "My Profile", icon: UserCircle, exact: true },
    { href: "/jobs", label: "Job Board", icon: Briefcase, exact: false },
    { href: "/applications", label: "My Applications", icon: FileText, exact: false },
    { href: "/status", label: "Verification Status", icon: Activity, exact: false },
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
                    <GraduationCap className="h-5 w-5 text-blue-600" />
                    <span className="font-semibold text-slate-900 tracking-tight">Student Portal</span>
                </div>
                <nav className="flex flex-1 flex-col gap-1 p-4">
                    {NAV.map(({ href, label, icon: Icon, exact }) => {
                        const isActive = exact ? pathname === href : pathname.startsWith(href);
                        return (
                            <Link
                                key={href}
                                href={href}
                                className={cn(
                                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                                    isActive
                                        ? "bg-blue-50 text-blue-700"
                                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                                )}
                            >
                                <Icon className="h-4 w-4" />
                                {label}
                            </Link>
                        );
                    })}
                </nav>
                <div className="border-t border-slate-200 p-4">
                    <div className="mb-3 px-3 text-xs text-slate-500 truncate">{user?.name ?? user?.email}</div>
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
                {/* Mobile header */}
                <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 lg:hidden">
                    <div className="flex items-center gap-2">
                        <GraduationCap className="h-5 w-5 text-blue-600" />
                        <span className="font-semibold text-slate-900">Student Portal</span>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    >
                        <LogOut className="h-4 w-4" />
                    </button>
                </header>

                {/* Mobile nav — horizontal scroll tabs */}
                <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-4 lg:hidden">
                    {NAV.map(({ href, label, icon: Icon, exact }) => {
                        const isActive = exact ? pathname === href : pathname.startsWith(href);
                        return (
                            <Link
                                key={href}
                                href={href}
                                className={cn(
                                    "flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors",
                                    isActive
                                        ? "border-blue-600 text-blue-700"
                                        : "border-transparent text-slate-500 hover:text-slate-900"
                                )}
                            >
                                <Icon className="h-4 w-4" />
                                {label}
                            </Link>
                        );
                    })}
                </nav>

                <main className="flex-1 p-6 lg:p-8">{children}</main>
            </div>
        </div>
    );
}
