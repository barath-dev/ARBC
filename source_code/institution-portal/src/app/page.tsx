"use client";

import { useQuery } from "@tanstack/react-query";
import { PortalShell } from "@/components/layout/portal-shell";
import { Briefcase, Users, Clock, CheckCircle2 } from "lucide-react";
import api from "@/lib/api";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

export default function DashboardPage() {
    const { data: boardData } = useQuery({
        queryKey: ["board", "entries"],
        queryFn: async () => {
            const { data } = await api.get("/jobs/board");
            return data.data.entries as any[];
        },
    });

    const { data: students } = useQuery({
        queryKey: ["institution", "students"],
        queryFn: async () => {
            const { data } = await api.get("/institutions/me/students");
            return data.data.students as any[];
        },
    });

    const pending = boardData?.filter((e: any) => e.status === "PENDING_INSTITUTION") ?? [];
    const approved = boardData?.filter((e: any) => e.status === "APPROVED") ?? [];

    const stats = [
        { label: "Students enrolled", value: students?.length ?? "—", icon: Users, color: "text-indigo-600 bg-indigo-50" },
        { label: "Jobs on board", value: approved.length, icon: Briefcase, color: "text-emerald-600 bg-emerald-50" },
        { label: "Pending approvals", value: pending.length, icon: Clock, color: "text-amber-600 bg-amber-50" },
        { label: "Total board entries", value: boardData?.length ?? "—", icon: CheckCircle2, color: "text-slate-600 bg-slate-100" },
    ];

    return (
        <PortalShell>
            <div className="space-y-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
                    <p className="mt-1 text-sm text-slate-500">Overview of your placement board and student cohort.</p>
                </div>

                {/* Stats */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {stats.map(({ label, value, icon: Icon, color }) => (
                        <div key={label} className="rounded-xl border border-slate-200 bg-white p-5">
                            <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${color} mb-3`}>
                                <Icon className="h-5 w-5" />
                            </div>
                            <p className="text-2xl font-bold text-slate-900">{value}</p>
                            <p className="text-sm text-slate-500 mt-0.5">{label}</p>
                        </div>
                    ))}
                </div>

                {/* Pending requests */}
                {pending.length > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                        <h2 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
                            <Clock className="h-4 w-4" /> {pending.length} job{pending.length !== 1 ? "s" : ""} awaiting approval
                        </h2>
                        <div className="space-y-2">
                            {pending.slice(0, 3).map((e: any) => (
                                <div key={e.id} className="flex items-center justify-between rounded-lg bg-white border border-amber-200 px-4 py-3 text-sm">
                                    <div>
                                        <p className="font-medium text-slate-900">{e.job?.title}</p>
                                        <p className="text-slate-500">{e.job?.company?.name} · {formatDistanceToNow(new Date(e.createdAt), { addSuffix: true })}</p>
                                    </div>
                                    <Link href="/jobs" className="text-indigo-600 font-medium hover:underline">Review →</Link>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Recent approved */}
                <div className="rounded-xl border border-slate-200 bg-white">
                    <div className="border-b border-slate-200 px-6 py-4">
                        <h2 className="font-semibold text-slate-900">Recent Job Board Activity</h2>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {approved.length === 0 ? (
                            <p className="px-6 py-8 text-sm text-slate-400 text-center">No approved jobs yet. Pull some from the Job Board.</p>
                        ) : (
                            approved.slice(0, 8).map((e: any) => (
                                <div key={e.id} className="flex items-center justify-between px-6 py-3 text-sm">
                                    <div>
                                        <p className="font-medium text-slate-900">{e.job?.title}</p>
                                        <p className="text-slate-500">{e.job?.company?.name}</p>
                                    </div>
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                                        <CheckCircle2 className="h-3 w-3" /> Approved
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </PortalShell>
    );
}
