"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PortalShell } from "@/components/layout/portal-shell";
import { ArrowLeft, Briefcase, MapPin, Loader2, Users, Building, Laptop, FileText } from "lucide-react";
import api from "@/lib/api";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";

type Job = {
    id: string;
    title: string;
    description: string | null;
    jobType: string;
    location: string | null;
    isRemote: boolean;
    visibility: "PUBLIC" | "INSTITUTION_SPECIFIC";
    status: "DRAFT" | "OPEN" | "CLOSED";
    openPositions: number;
    createdAt: string;
    company: { name: string; website: string | null };
};

type Claim = {
    id: string;
    title: string;
    type: string;
};

export default function StudentJobDetailPage() {
    const { id: jobId } = useParams<{ id: string }>();
    const qc = useQueryClient();

    const [isApplying, setIsApplying] = useState(false);
    const [selectedClaims, setSelectedClaims] = useState<string[]>([]);
    const [coverNote, setCoverNote] = useState("");

    const { data: profile } = useQuery({
        queryKey: ["student", "me"],
        queryFn: async () => {
            const { data } = await api.get("/student/me");
            return data.data.student;
        },
    });

    const { data: job, isLoading } = useQuery({
        queryKey: ["student", "job", jobId],
        queryFn: async () => {
            const { data } = await api.get(`/jobs/${jobId}`);
            return data.data.job as Job;
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
                jobId: job!.id,
                disclosedClaimIds: selectedClaims,
                coverNote: coverNote || undefined,
            });
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["applications", "mine"] });
            setIsApplying(false);
            setSelectedClaims([]);
            setCoverNote("");
        },
    });

    const applied = myApps.some((a: any) => a.jobId === jobId);
    const claims: Claim[] = profile?.claims ?? [];

    const openApplyModal = () => {
        setIsApplying(true);
        setSelectedClaims(claims.map((c) => c.id));
    };

    const toggleClaim = (id: string) => {
        setSelectedClaims((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    return (
        <PortalShell>
            <div className="space-y-6 max-w-4xl mx-auto">
                <div>
                    <Link href="/jobs" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 mb-4 transition-colors">
                        <ArrowLeft className="h-4 w-4" /> Back to Jobs
                    </Link>
                </div>

                {isLoading ? (
                    <div className="flex h-32 items-center justify-center text-sm text-slate-500">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading job details…
                    </div>
                ) : !job ? (
                    <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
                        Job not found.
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Header Section */}
                        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                            <div className="flex justify-between items-start gap-4 flex-wrap">
                                <div>
                                    <h1 className="text-2xl font-bold text-slate-900 mb-2">{job.title}</h1>
                                    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                                        <div className="flex items-center gap-1.5">
                                            <Briefcase className="h-4 w-4 text-slate-400" />
                                            {job.jobType.replace("_", " ")}
                                        </div>
                                        {job.location && (
                                            <div className="flex items-center gap-1.5">
                                                <MapPin className="h-4 w-4 text-slate-400" />
                                                {job.location}
                                            </div>
                                        )}
                                        {job.isRemote && (
                                            <div className="flex items-center gap-1.5 text-emerald-600 font-medium">
                                                <Laptop className="h-4 w-4" />
                                                Remote
                                            </div>
                                        )}
                                        <div className="flex items-center gap-1.5">
                                            <Building className="h-4 w-4 text-slate-400" />
                                            {job.visibility === "PUBLIC" ? "Publicly Visible" : "Institution Specific"}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Users className="h-4 w-4 text-slate-400" />
                                            {job.openPositions} Position{job.openPositions !== 1 ? "s" : ""}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide
                                        ${job.status === "OPEN" ? "bg-emerald-100 text-emerald-700" :
                                          job.status === "DRAFT" ? "bg-amber-100 text-amber-700" :
                                          "bg-slate-100 text-slate-600"}`}>
                                        {job.status}
                                    </span>
                                </div>
                            </div>
                            
                            <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between">
                                <div className="text-xs text-slate-500">
                                    Posted {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                                </div>
                                <div className="flex gap-3">
                                    {applied ? (
                                        <span className="inline-flex items-center justify-center rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700">
                                            Applied ✓
                                        </span>
                                    ) : (
                                        <button
                                            onClick={openApplyModal}
                                            disabled={job.status !== "OPEN"}
                                            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors disabled:opacity-50"
                                        >
                                            Apply Now
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Description Section */}
                        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                            <div className="border-b border-slate-200 bg-slate-50 px-6 py-4 flex items-center gap-2">
                                <FileText className="h-4 w-4 text-slate-500" />
                                <h2 className="font-semibold text-slate-900">Job Description</h2>
                            </div>
                            <div className="p-6">
                                <div className="prose prose-slate prose-sm max-w-none whitespace-pre-wrap">
                                    {job.description || <span className="text-slate-400 italic">No description provided.</span>}
                                </div>
                            </div>
                        </div>

                        {/* Skills Section */}
                        {(job as any).skills && (job as any).skills.length > 0 && (
                            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                                <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
                                    <h2 className="font-semibold text-slate-900">Required Skills</h2>
                                </div>
                                <div className="p-6">
                                    <div className="flex flex-wrap gap-2">
                                        {(job as any).skills.map((skill: string) => (
                                            <span key={skill} className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                                                {skill}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {/* Company Details */}
                        {job.company && (
                            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                                <div className="border-b border-slate-200 bg-slate-50 px-6 py-4 flex items-center gap-2">
                                    <Building className="h-4 w-4 text-slate-500" />
                                    <h2 className="font-semibold text-slate-900">About {job.company.name}</h2>
                                </div>
                                <div className="p-6">
                                    {job.company.website ? (
                                        <a href={job.company.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-500 text-sm font-medium">
                                            {job.company.website}
                                        </a>
                                    ) : (
                                        <p className="text-sm text-slate-500 italic">No company website provided.</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Apply Modal */}
            {isApplying && job && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl">
                        <div className="border-b border-slate-200 px-6 py-4">
                            <h2 className="font-semibold text-slate-900">Apply to {job.title}</h2>
                            <p className="text-sm text-slate-500 mt-0.5">{job.company.name}</p>
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
                                onClick={() => { setIsApplying(false); setSelectedClaims([]); setCoverNote(""); }}
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
