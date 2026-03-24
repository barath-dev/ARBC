"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PortalShell } from "@/components/layout/portal-shell";
import Link from "next/link";
import { Briefcase, Loader2 } from "lucide-react";
import api from "@/lib/api";

type Job = {
    id: string;
    title: string;
    description: string;
    location: string | null;
    type: string;
    visibility: string;
    status: string;
    company: { name: string };
    entries: { id: string; status: string }[];
};

type Claim = {
    id: string;
    type: string;
    title: string;
};

export default function JobBoardPage() {
    const qc = useQueryClient();
    const [applyingTo, setApplyingTo] = useState<Job | null>(null);
    const [selectedClaims, setSelectedClaims] = useState<string[]>([]);
    const [coverNote, setCoverNote] = useState("");

    const { data: jobs = [], isLoading } = useQuery({
        queryKey: ["jobs", "board"],
        queryFn: async () => {
            const { data } = await api.get("/jobs/board");
            return data.data.jobs as Job[];
        },
    });

    const { data: profile } = useQuery({
        queryKey: ["student", "me"],
        queryFn: async () => {
            const { data } = await api.get("/student/me");
            return data.data.student;
        },
    });

    const { data: myApps = [] } = useQuery({
        queryKey: ["applications", "mine"],
        queryFn: async () => {
            const { data } = await api.get("/applications/mine");
            return data.data.applications as any[];
        },
    });

    const applyMutation = useMutation({
        mutationFn: async () => {
            return api.post("/applications", {
                jobId: applyingTo!.id,
                disclosedClaimIds: selectedClaims,
                coverNote: coverNote || undefined,
            });
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["applications", "mine"] });
            setApplyingTo(null);
            setSelectedClaims([]);
            setCoverNote("");
        },
    });

    const appliedJobIds = new Set(myApps.map((a: any) => a.jobId));
    const claims: Claim[] = profile?.claims ?? [];

    const openApplyModal = (job: Job) => {
        setApplyingTo(job);
        setSelectedClaims(claims.map((c) => c.id)); // default: disclose all
    };

    const toggleClaim = (id: string) => {
        setSelectedClaims((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    return (
        <PortalShell>
            <div className="space-y-6">
                <div>
                    <h1 className="text-xl font-bold text-slate-900">Job Board</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Jobs available to students at your institution.
                    </p>
                </div>

                {isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading jobs…
                    </div>
                ) : jobs.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
                        <Briefcase className="mx-auto h-8 w-8 text-slate-300 mb-3" />
                        <p className="text-sm text-slate-500">No jobs on your board yet.</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {jobs.map((job) => {
                            const applied = appliedJobIds.has(job.id);
                            return (
                                <div key={job.id} className="rounded-xl border border-slate-200 bg-white p-5 flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <Link href={`/jobs/${job.id}`} className="font-semibold text-slate-900 hover:text-blue-600 transition-colors">
                                                {job.title}
                                            </Link>
                                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{job.type}</span>
                                            {job.visibility === "PUBLIC" ? (
                                                <span className="rounded-full bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 text-xs">Public</span>
                                            ) : (
                                                <span className="rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200 px-2 py-0.5 text-xs">Internal</span>
                                            )}
                                        </div>
                                        <p className="text-sm text-slate-500">{job.company.name}{job.location ? ` · ${job.location}` : ""}</p>
                                        {job.description && (
                                            <p className="mt-2 text-sm text-slate-600 line-clamp-2">{job.description}</p>
                                        )}
                                    </div>
                                    <div className="shrink-0">
                                        {applied ? (
                                            <span className="inline-block rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700">
                                                Applied ✓
                                            </span>
                                        ) : (
                                            <button
                                                onClick={() => openApplyModal(job)}
                                                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                                            >
                                                Apply
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Apply Modal */}
            {applyingTo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl">
                        <div className="border-b border-slate-200 px-6 py-4">
                            <h2 className="font-semibold text-slate-900">Apply to {applyingTo.title}</h2>
                            <p className="text-sm text-slate-500 mt-0.5">{applyingTo.company.name}</p>
                        </div>

                        <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
                            <div>
                                <p className="text-sm font-medium text-slate-700 mb-2">
                                    Select claims to disclose to the recruiter
                                </p>
                                {claims.length === 0 ? (
                                    <p className="text-sm text-slate-500 italic">No claims on your profile yet. You can still apply.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {claims.map((c) => (
                                            <label key={c.id} className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 cursor-pointer hover:bg-slate-50">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedClaims.includes(c.id)}
                                                    onChange={() => toggleClaim(c.id)}
                                                    className="h-4 w-4 rounded border-slate-300 text-blue-600"
                                                />
                                                <div>
                                                    <p className="text-sm font-medium text-slate-800">{c.title}</p>
                                                    <p className="text-xs text-slate-500 capitalize">{c.type.toLowerCase()}</p>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Cover note <span className="font-normal text-slate-400">(optional)</span>
                                </label>
                                <textarea
                                    value={coverNote}
                                    onChange={(e) => setCoverNote(e.target.value)}
                                    rows={3}
                                    placeholder="A short message to the recruiter…"
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-none"
                                />
                            </div>
                        </div>

                        <div className="border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
                            <button
                                onClick={() => { setApplyingTo(null); setSelectedClaims([]); setCoverNote(""); }}
                                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => applyMutation.mutate()}
                                disabled={applyMutation.isPending}
                                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2"
                            >
                                {applyMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                Submit Application
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </PortalShell>
    );
}
