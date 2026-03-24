"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ArrowLeft, AlertTriangle, CheckCircle2, Clock, Loader2, ShieldCheck } from "lucide-react";
import api from "@/lib/api";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
    APPLIED: "bg-blue-50 text-blue-700",
    UNDER_REVIEW: "bg-amber-50 text-amber-700",
    SHORTLISTED: "bg-indigo-50 text-indigo-700",
    OFFERED: "bg-emerald-50 text-emerald-700",
    REJECTED: "bg-rose-50 text-rose-600",
    WITHDRAWN: "bg-slate-100 text-slate-500",
};

const RISK_COLORS: Record<string, string> = {
    LOW: "text-emerald-600",
    MEDIUM: "text-amber-600",
    HIGH: "text-rose-600",
};

const NEXT_STATUSES: Record<string, string[]> = {
    APPLIED: ["SHORTLISTED", "REJECTED"],
    UNDER_REVIEW: ["SHORTLISTED", "REJECTED"],
    SHORTLISTED: ["OFFERED", "REJECTED"],
};

export default function ApplicationsPage() {
    const { id: jobId } = useParams<{ id: string }>();
    const qc = useQueryClient();

    const { data: job } = useQuery({
        queryKey: ["recruiter", "job", jobId],
        queryFn: async () => {
            const { data } = await api.get(`/jobs/${jobId}`);
            return data.data.job;
        },
    });

    const { data: apps = [], isLoading } = useQuery({
        queryKey: ["applications", "job", jobId],
        queryFn: async () => {
            const { data } = await api.get(`/applications/job/${jobId}`);
            return data.data.applications as any[];
        },
    });

    const statusMutation = useMutation({
        mutationFn: ({ appId, status }: { appId: string; status: string }) =>
            api.patch(`/applications/${appId}/status`, { status }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["applications", "job", jobId] }),
    });

    const viewMutation = useMutation({
        mutationFn: (appId: string) => api.get(`/applications/${appId}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["applications", "job", jobId] }),
    });

    return (
        <DashboardShell>
            <div className="space-y-6">
                <div>
                    <Link href="/jobs" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 mb-4">
                        <ArrowLeft className="h-4 w-4" /> Back to Jobs
                    </Link>
                    <h1 className="text-2xl font-bold text-slate-900">{job?.title ?? "Applications"}</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        {apps.length} applicant{apps.length !== 1 ? "s" : ""}
                    </p>
                </div>

                {isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
                ) : apps.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
                        No applications yet.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {apps.map((app: any) => {
                            const arbc = app.verificationRequest;
                            const result = arbc?.result;
                            return (
                                <div key={app.id} className="rounded-xl border border-slate-200 bg-white p-5">
                                    <div className="flex items-start justify-between gap-4 flex-wrap">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                <h2 className="font-semibold text-slate-900">
                                                    {app.student?.user?.name ?? "Student"}
                                                </h2>
                                                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[app.status] ?? ""}`}>
                                                    {app.status.replace("_", " ")}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-500">{app.student?.user?.email}</p>
                                            <p className="text-xs text-slate-400 mt-0.5">
                                                Applied {formatDistanceToNow(new Date(app.createdAt), { addSuffix: true })}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2 flex-wrap">
                                            {/* Trigger ARBC on first view */}
                                            {!arbc && (
                                                <button
                                                    onClick={() => viewMutation.mutate(app.id)}
                                                    disabled={viewMutation.isPending}
                                                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                                                >
                                                    <ShieldCheck className="h-3.5 w-3.5 text-indigo-500" />
                                                    {viewMutation.isPending ? "Triggering…" : "View & Start ARBC"}
                                                </button>
                                            )}
                                            {/* Status actions */}
                                            {NEXT_STATUSES[app.status]?.map((s) => (
                                                <button
                                                    key={s}
                                                    onClick={() => {
                                                        if (window.confirm(`Are you sure you want to change the status to ${s.replace("_", " ")}?`)) {
                                                            statusMutation.mutate({ appId: app.id, status: s });
                                                        }
                                                    }}
                                                    disabled={statusMutation.isPending}
                                                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                                                        s === "REJECTED"
                                                            ? "bg-rose-50 text-rose-700 hover:bg-rose-100"
                                                            : s === "OFFERED"
                                                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                                            : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                                                    }`}
                                                >
                                                    {s.charAt(0) + s.slice(1).toLowerCase()}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Cover note */}
                                    {app.coverNote && (
                                        <p className="mt-3 text-sm text-slate-600 italic border-l-2 border-slate-200 pl-3">
                                            "{app.coverNote}"
                                        </p>
                                    )}

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

                                    {/* ARBC Result */}
                                    {arbc && (
                                        <div className="mt-4 pt-4 border-t border-slate-100">
                                            <div className="flex items-center gap-2 mb-3">
                                                <ShieldCheck className="h-4 w-4 text-indigo-500" />
                                                <span className="text-xs font-semibold text-slate-700">ARBC Verification</span>
                                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                                    arbc.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" :
                                                    arbc.status === "FAILED" ? "bg-rose-100 text-rose-700" :
                                                    "bg-amber-100 text-amber-700"
                                                }`}>
                                                    {arbc.status}
                                                </span>
                                            </div>

                                            {result ? (
                                                <div className="grid gap-3 sm:grid-cols-4">
                                                    <div className="rounded-lg border border-slate-200 p-3 text-center">
                                                        <p className="text-xs text-slate-500 mb-1">Overall Risk</p>
                                                        <p className={`text-xl font-bold ${RISK_COLORS[result.riskLevel]}`}>
                                                            {result.riskLevel}
                                                        </p>
                                                        <p className="text-xs text-slate-400 mt-0.5">
                                                            {(result.overallRiskScore * 100).toFixed(1)}%
                                                        </p>
                                                    </div>
                                                    {[
                                                        { label: "GitHub", value: result.githubScore },
                                                        { label: "Company", value: result.companyScore },
                                                        { label: "Document", value: result.documentScore },
                                                    ].map(({ label, value }) => (
                                                        <div key={label} className="rounded-lg border border-slate-200 p-3 text-center">
                                                            <p className="text-xs text-slate-500 mb-1">{label}</p>
                                                            <p className="text-lg font-semibold text-slate-900">
                                                                {value !== null && value !== undefined ? `${(value * 100).toFixed(0)}%` : "N/A"}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 text-sm text-slate-500">
                                                    <Clock className="h-4 w-4 animate-pulse" />
                                                    Verification running in background…
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </DashboardShell>
    );
}
