"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ArrowLeft, Briefcase, MapPin, Loader2, Users, Building, Laptop, FileText } from "lucide-react";
import api from "@/lib/api";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

export default function JobDetailPage() {
    const { id: jobId } = useParams<{ id: string }>();

    const { data: job, isLoading } = useQuery({
        queryKey: ["recruiter", "job", jobId],
        queryFn: async () => {
            const { data } = await api.get(`/jobs/${jobId}`);
            return data.data.job;
        },
    });

    return (
        <DashboardShell>
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
                                    <Link 
                                        href={`/jobs/${job.id}/applications`}
                                        className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
                                    >
                                        View Applications
                                    </Link>
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
                        {job.skills && job.skills.length > 0 && (
                            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                                <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
                                    <h2 className="font-semibold text-slate-900">Required Skills</h2>
                                </div>
                                <div className="p-6">
                                    <div className="flex flex-wrap gap-2">
                                        {job.skills.map((skill: string) => (
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
                                        <a href={job.company.website} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-500 text-sm font-medium">
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
        </DashboardShell>
    );
}
