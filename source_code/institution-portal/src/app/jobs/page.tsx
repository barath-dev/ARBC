"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PortalShell } from "@/components/layout/portal-shell";
import Link from "next/link";
import { CheckCircle2, XCircle, PlusCircle, Download, Briefcase } from "lucide-react";
import api from "@/lib/api";
import { formatDistanceToNow } from "date-fns";

type Tab = "pending" | "approved" | "rejected";

const STATUS_LABELS: Record<string, string> = {
    PENDING_INSTITUTION: "Awaiting Approval",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    WITHDRAWN: "Withdrawn",
};

const BADGE: Record<string, string> = {
    APPROVED: "bg-emerald-100 text-emerald-700",
    PENDING_INSTITUTION: "bg-amber-100 text-amber-700",
    REJECTED: "bg-rose-100 text-rose-700",
    WITHDRAWN: "bg-slate-100 text-slate-500",
};

export default function JobsPage() {
    const qc = useQueryClient();
    const [tab, setTab] = useState<Tab>("pending");

    const { data: entries = [], isLoading } = useQuery({
        queryKey: ["board", "all"],
        queryFn: async () => {
            const { data } = await api.get("/jobs/board");
            return data.data.entries as any[];
        },
    });

    const approveMutation = useMutation({
        mutationFn: (entryId: string) => api.patch(`/board/entries/${entryId}/approve`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["board"] }),
    });
    const rejectMutation = useMutation({
        mutationFn: (entryId: string) => api.patch(`/board/entries/${entryId}/reject`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["board"] }),
    });
    const removeMutation = useMutation({
        mutationFn: (entryId: string) => api.delete(`/board/entries/${entryId}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["board"] }),
    });

    const filtered = entries.filter((e: any) => {
        if (tab === "pending") return e.status === "PENDING_INSTITUTION";
        if (tab === "approved") return e.status === "APPROVED";
        return e.status === "REJECTED" || e.status === "WITHDRAWN";
    });

    const pendingCount = entries.filter((e: any) => e.status === "PENDING_INSTITUTION").length;

    return (
        <PortalShell>
            <div className="space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Job Board</h1>
                        <p className="mt-1 text-sm text-slate-500">Manage which jobs are shown to your students.</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 w-fit">
                    {([
                        { key: "pending", label: `Pending${pendingCount > 0 ? ` (${pendingCount})` : ""}` },
                        { key: "approved", label: "Approved" },
                        { key: "rejected", label: "Rejected" },
                    ] as { key: Tab; label: string }[]).map(({ key, label }) => (
                        <button
                            key={key}
                            onClick={() => setTab(key)}
                            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${tab === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {/* Table */}
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                    {isLoading ? (
                        <div className="px-6 py-12 text-center text-sm text-slate-400">Loading…</div>
                    ) : filtered.length === 0 ? (
                        <div className="px-6 py-12 text-center">
                            <Briefcase className="mx-auto h-8 w-8 text-slate-300 mb-3" />
                            <p className="text-sm text-slate-500">No {tab} entries.</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="border-b border-slate-200 bg-slate-50 text-left">
                                <tr>
                                    <th className="px-5 py-3 font-medium text-slate-600">Job</th>
                                    <th className="px-5 py-3 font-medium text-slate-600">Company</th>
                                    <th className="px-5 py-3 font-medium text-slate-600">Initiator</th>
                                    <th className="px-5 py-3 font-medium text-slate-600">Status</th>
                                    <th className="px-5 py-3 font-medium text-slate-600">Added</th>
                                    <th className="px-5 py-3 font-medium text-slate-600 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filtered.map((e: any) => (
                                    <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-5 py-3 font-medium text-slate-900">
                                            {e.job ? (
                                                <div className="flex flex-col gap-1">
                                                    <Link href={`/jobs/${e.job.id}`} className="hover:text-emerald-600 transition-colors">
                                                        {e.job.title}
                                                    </Link>
                                                    {e.job.visibility === "INSTITUTION_SPECIFIC" && (
                                                        <span className="w-fit rounded-full bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-600 uppercase tracking-tight">
                                                            Internal
                                                        </span>
                                                    )}
                                                </div>
                                            ) : "—"}
                                        </td>
                                        <td className="px-5 py-3 text-slate-600">{e.job?.company?.name ?? "—"}</td>
                                        <td className="px-5 py-3 text-slate-500 capitalize">{e.initiator?.toLowerCase()}</td>
                                        <td className="px-5 py-3">
                                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE[e.status] ?? ""}`}>
                                                {STATUS_LABELS[e.status] ?? e.status}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-slate-500">
                                            {formatDistanceToNow(new Date(e.createdAt), { addSuffix: true })}
                                        </td>
                                        <td className="px-5 py-3 text-right">
                                            <div className="flex justify-end gap-2">
                                                {e.status === "PENDING_INSTITUTION" && (
                                                    <>
                                                        <button
                                                            onClick={() => approveMutation.mutate(e.id)}
                                                            disabled={approveMutation.isPending}
                                                            className="flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
                                                        >
                                                            <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                                                        </button>
                                                        <button
                                                            onClick={() => rejectMutation.mutate(e.id)}
                                                            disabled={rejectMutation.isPending}
                                                            className="flex items-center gap-1 rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 transition-colors"
                                                        >
                                                            <XCircle className="h-3.5 w-3.5" /> Reject
                                                        </button>
                                                    </>
                                                )}
                                                {e.status === "APPROVED" && (
                                                    <button
                                                        onClick={() => { if (confirm("Remove this job from your board?")) removeMutation.mutate(e.id); }}
                                                        className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors"
                                                    >
                                                        Remove
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </PortalShell>
    );
}
