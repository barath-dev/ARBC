"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PortalShell } from "@/components/layout/portal-shell";
import { Loader2, FileText, ArrowUpRight } from "lucide-react";
import api from "@/lib/api";
import { formatDistanceToNow } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
    APPLIED: "bg-blue-50 text-blue-700 border-blue-200",
    UNDER_REVIEW: "bg-amber-50 text-amber-700 border-amber-200",
    SHORTLISTED: "bg-indigo-50 text-indigo-700 border-indigo-200",
    OFFERED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    REJECTED: "bg-rose-50 text-rose-700 border-rose-200",
    WITHDRAWN: "bg-slate-100 text-slate-500 border-slate-200",
};

export default function ApplicationsPage() {
    const qc = useQueryClient();

    const { data: apps = [], isLoading } = useQuery({
        queryKey: ["applications", "mine"],
        queryFn: async () => {
            const { data } = await api.get("/applications/mine");
            return data.data.applications as any[];
        },
    });

    const withdrawMutation = useMutation({
        mutationFn: (id: string) => api.delete(`/applications/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["applications", "mine"] }),
    });

    const canWithdraw = (status: string) => ["APPLIED", "UNDER_REVIEW"].includes(status);

    return (
        <PortalShell>
            <div className="space-y-6">
                <div>
                    <h1 className="text-xl font-bold text-slate-900">My Applications</h1>
                    <p className="mt-1 text-sm text-slate-500">Track the status of your job applications.</p>
                </div>

                {isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                    </div>
                ) : apps.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
                        <FileText className="mx-auto h-8 w-8 text-slate-300 mb-3" />
                        <p className="font-medium text-slate-700">No applications yet</p>
                        <p className="mt-1 text-sm text-slate-500">Browse the Job Board to apply to open roles.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {apps.map((app: any) => (
                            <div key={app.id} className="rounded-xl border border-slate-200 bg-white p-5">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <h2 className="font-semibold text-slate-900">{app.job?.title ?? "Role"}</h2>
                                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[app.status] ?? "bg-slate-100 text-slate-600"}`}>
                                                {app.status.replace("_", " ")}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-500">
                                            {app.job?.company?.name ?? "Company"}
                                        </p>
                                        {app.coverNote && (
                                            <p className="mt-2 text-sm text-slate-600 italic line-clamp-2">"{app.coverNote}"</p>
                                        )}
                                        <p className="mt-2 text-xs text-slate-400">
                                            Applied {formatDistanceToNow(new Date(app.createdAt), { addSuffix: true })}
                                        </p>
                                    </div>
                                    <div className="flex-shrink-0">
                                        {canWithdraw(app.status) && (
                                            <button
                                                onClick={() => {
                                                    if (confirm("Withdraw this application?")) withdrawMutation.mutate(app.id);
                                                }}
                                                disabled={withdrawMutation.isPending}
                                                className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                                            >
                                                Withdraw
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Disclosed claims */}
                                {app.disclosedClaims?.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-slate-100">
                                        <p className="text-xs font-medium text-slate-500 mb-2">Disclosed claims</p>
                                        <div className="flex flex-wrap gap-2">
                                            {app.disclosedClaims.map((dc: any) => (
                                                <span key={dc.id} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
                                                    {dc.claim?.title ?? dc.claimId}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </PortalShell>
    );
}
