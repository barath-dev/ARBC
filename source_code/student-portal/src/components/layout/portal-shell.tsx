import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { Shield, UserCircle, Activity, LogOut } from "lucide-react";

export function PortalShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { user, logout } = useAuthStore();

    const navigation = [
        { name: "My Profile", href: "/", icon: UserCircle },
        { name: "Verification Status", href: "/status", icon: Activity },
    ];

    return (
        <div className="flex min-h-screen flex-col bg-slate-50">
            <header className="sticky top-0 z-40 border-b border-slate-200 bg-white px-4 sm:px-6 shadow-sm">
                <div className="mx-auto flex h-16 max-w-5xl items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Shield className="h-6 w-6 text-slate-900" />
                        <span className="text-xl font-bold tracking-tight text-slate-900">ARBC</span>
                        <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ml-2 border border-blue-200">
                            Student Portal
                        </span>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="text-sm font-medium text-slate-700 hidden sm:block">
                            {user?.name}
                        </div>
                        <button
                            onClick={() => logout()}
                            className="inline-flex items-center justify-center rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-500 focus:outline-none"
                        >
                            <LogOut className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 w-full max-w-5xl mx-auto p-4 sm:p-6 md:p-8">
                <div className="flex flex-col md:flex-row gap-8">
                    {/* Navigation Sidebar */}
                    <aside className="w-full md:w-64 flex-shrink-0">
                        <nav className="flex flex-row md:flex-col gap-2 overflow-x-auto pb-2 md:pb-0" aria-label="Sidebar">
                            {navigation.map((item) => {
                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap ${isActive
                                                ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                                                : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-900"
                                            }`}
                                    >
                                        <item.icon
                                            className={`h-4 w-4 flex-shrink-0 ${isActive ? "text-blue-600" : "text-slate-400"
                                                }`}
                                            aria-hidden="true"
                                        />
                                        {item.name}
                                    </Link>
                                );
                            })}
                        </nav>
                    </aside>

                    {/* Content Area */}
                    <div className="flex-1 min-w-0">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
}
