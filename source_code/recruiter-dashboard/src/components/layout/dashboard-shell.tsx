import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { ShieldCheck, LayoutDashboard, Users, LogOut } from "lucide-react";

export function DashboardShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { user, logout } = useAuthStore();

    const navigation = [
        { name: "Overview", href: "/", icon: LayoutDashboard },
        { name: "Students & Reports", href: "/students", icon: Users },
    ];

    return (
        <div className="flex min-h-screen flex-col">
            <header className="sticky top-0 z-40 border-b border-slate-200 bg-white shadow-sm">
                <div className="container flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="h-6 w-6 text-slate-900" />
                        <span className="text-xl font-bold tracking-tight text-slate-900">ARBC</span>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ml-2">Recruiter</span>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="text-sm font-medium text-slate-700 hidden sm:block">
                            {user?.name}
                        </div>
                        <button
                            onClick={() => logout()}
                            className="inline-flex items-center justify-center rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-slate-900"
                        >
                            <LogOut className="h-5 w-5" aria-hidden="true" />
                        </button>
                    </div>
                </div>
            </header>

            <div className="flex flex-1">
                <aside className="w-64 flex-shrink-0 border-r border-slate-200 bg-white hidden md:block">
                    <nav className="flex flex-1 flex-col space-y-1 p-4" aria-label="Sidebar">
                        {navigation.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${isActive
                                            ? "bg-slate-50 text-slate-900"
                                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                        }`}
                                >
                                    <item.icon
                                        className={`h-5 w-5 flex-shrink-0 ${isActive ? "text-slate-900" : "text-slate-400"
                                            }`}
                                        aria-hidden="true"
                                    />
                                    {item.name}
                                </Link>
                            );
                        })}
                    </nav>
                </aside>

                <main className="flex-1">
                    <div className="py-6">
                        <div className="container px-4 sm:px-6 md:px-8">
                            {children}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
