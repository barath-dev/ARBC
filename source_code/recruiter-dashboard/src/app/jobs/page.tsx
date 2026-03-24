"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Plus, Pencil, Trash2, Users, ChevronRight, Loader2, Briefcase, Send, X, CheckCircle2 } from "lucide-react";
import api from "@/lib/api";
import Link from "next/link";
import { toast } from "sonner";

type Job = {
    id: string;
    title: string;
    description?: string;
    jobType: string;
    location: string | null;
    status: "DRAFT" | "OPEN" | "CLOSED";
    visibility: "PUBLIC" | "INSTITUTION_SPECIFIC";
    _count?: { applications: number };
};

type Institution = { id: string; name: string; domain: string };
type BoardEntry = {
    id: string;
    institutionId: string;
    status: string;
    institution: Institution;
};

const STATUS_COLORS: Record<Job["status"], string> = {
    DRAFT: "bg-slate-100 text-slate-600",
    OPEN: "bg-emerald-100 text-emerald-700",
    CLOSED: "bg-rose-100 text-rose-600",
};

const ENTRY_BADGE: Record<string, string> = {
    APPROVED: "bg-emerald-100 text-emerald-700",
    PENDING_INSTITUTION: "bg-amber-100 text-amber-700",
    REJECTED: "bg-rose-100 text-rose-600",
};

const BLANK_FORM: {
    title: string;
    description: string;
    jobType: string;
    location: string;
    visibility: "PUBLIC" | "INSTITUTION_SPECIFIC";
} = { title: "", description: "", jobType: "FULL_TIME", location: "", visibility: "PUBLIC" };


export default function JobsPage() {
    const qc = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Job | null>(null);
    const [form, setForm] = useState(BLANK_FORM);
    const [pushingJob, setPushingJob] = useState<Job | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const { data: jobs = [], isLoading } = useQuery({
        queryKey: ["recruiter", "jobs"],
        queryFn: async () => {
            const { data } = await api.get("/jobs/mine");
            return data.data.jobs as Job[];
        },
    });

    const { data: allInstitutions = [] } = useQuery({
        queryKey: ["board", "institutions"],
        queryFn: async () => {
            const { data } = await api.get("/board/institutions");
            return data.data.institutions as Institution[];
        },
        enabled: !!pushingJob,
    });

    const { data: existingEntries = [], refetch: refetchEntries } = useQuery({
        queryKey: ["board", "entries", "job", pushingJob?.id],
        queryFn: async () => {
            const { data } = await api.get(`/board/entries/job/${pushingJob!.id}`);
            return data.data.entries as BoardEntry[];
        },
        enabled: !!pushingJob,
    });

    const pushedIds = new Set(existingEntries.map((e) => e.institutionId));
    const availableInstitutions = allInstitutions.filter((i) => !pushedIds.has(i.id));

    const createMutation = useMutation({
        mutationFn: () => api.post("/jobs", form),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["recruiter", "jobs"] }); setShowForm(false); setForm(BLANK_FORM); },
    });

    const updateMutation = useMutation({
        mutationFn: () => api.put(`/jobs/${editing!.id}`, form),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["recruiter", "jobs"] }); setEditing(null); setForm(BLANK_FORM); },
    });

    const publishMutation = useMutation({
        mutationFn: (id: string) => api.post(`/jobs/${id}/publish`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["recruiter", "jobs"] }),
    });

    const closeMutation = useMutation({
        mutationFn: (id: string) => api.post(`/jobs/${id}/close`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["recruiter", "jobs"] }),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.delete(`/jobs/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["recruiter", "jobs"] }),
    });

    const pushMutation = useMutation({
        mutationFn: async () => {
            const ids = Array.from(selectedIds);
            const results = await Promise.allSettled(
                ids.map((instId) => api.post(`/board/push/${pushingJob!.id}/${instId}`))
            );
            const failures = results.filter(
                (r) => r.status === "rejected" && r.reason?.response?.status !== 409
            );
            if (failures.length > 0) throw new Error(`${failures.length} push(es) failed.`);
        },
        onSuccess: () => {
            const count = selectedIds.size;
            toast.success(`Job pushed to ${count} institution${count > 1 ? "s" : ""} for approval.`);
            setSelectedIds(new Set());
            refetchEntries();
        },
        onError: (err: any) => {
            toast.error(err?.message ?? "One or more pushes failed.");
            refetchEntries();
        },
    });

    const toggleInstitution = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const openEdit = (job: Job) => {
        setEditing(job);
        setForm({ title: job.title, description: job.description ?? "", jobType: job.jobType, location: job.location ?? "", visibility: job.visibility });
    };

    const openPushModal = (job: Job) => {
        setPushingJob(job);
        setSelectedIds(new Set());
    };

    const closePushModal = () => { setPushingJob(null); setSelectedIds(new Set()); };

    const isFormOpen = showForm || editing !== null;

    return (
        <DashboardShell>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Jobs</h1>
                        <p className="mt-1 text-sm text-slate-500">Manage your job postings.</p>
                    </div>
                    <button
                        onClick={() => { setShowForm(true); setEditing(null); setForm(BLANK_FORM); }}
                        className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
                    >
                        <Plus className="h-4 w-4" /> New Job
                    </button>
                </div>

                {/* Create / Edit Form */}
                {isFormOpen && (
                    <div className="rounded-xl border border-slate-200 bg-white p-6">
                        <h2 className="font-semibold text-slate-900 mb-4">{editing ? "Edit Job" : "Create New Job"}</h2>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                                <label className="block text-xs font-medium text-slate-600 mb-1.5">Title *</label>
                                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                                    placeholder="e.g. Software Engineer Intern"
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1.5">Type</label>
                                <select value={form.jobType} onChange={(e) => setForm({ ...form, jobType: e.target.value })}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500">
                                    {["FULL_TIME", "PART_TIME", "INTERNSHIP", "CONTRACT"].map((t) => (
                                        <option key={t} value={t}>{t.replace("_", " ")}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1.5">Visibility</label>
                                <select value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value as any })}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500">
                                    <option value="PUBLIC">Public</option>
                                    <option value="INSTITUTION_SPECIFIC">Institution Specific</option>
                                </select>
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block text-xs font-medium text-slate-600 mb-1.5">Location</label>
                                <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                                    placeholder="e.g. Bengaluru (Remote OK)"
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500" />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block text-xs font-medium text-slate-600 mb-1.5">Description</label>
                                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    rows={3} placeholder="Job description, requirements…"
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 resize-none" />
                            </div>
                        </div>
                        <div className="mt-4 flex justify-end gap-3">
                            <button onClick={() => { setShowForm(false); setEditing(null); }}
                                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
                            <button
                                onClick={() => editing ? updateMutation.mutate() : createMutation.mutate()}
                                disabled={!form.title || createMutation.isPending || updateMutation.isPending}
                                className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                            >
                                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                {editing ? "Save Changes" : "Create Job"}
                            </button>
                        </div>
                    </div>
                )}

                {/* Jobs Table */}
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                    {isLoading ? (
                        <div className="px-6 py-12 text-center text-sm text-slate-400">Loading…</div>
                    ) : jobs.length === 0 ? (
                        <div className="px-6 py-12 text-center">
                            <Briefcase className="mx-auto h-8 w-8 text-slate-300 mb-3" />
                            <p className="text-sm text-slate-500">No jobs yet. Create your first posting.</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="border-b border-slate-200 bg-slate-50 text-left">
                                <tr>
                                    <th className="px-5 py-3 font-medium text-slate-600">Title</th>
                                    <th className="px-5 py-3 font-medium text-slate-600">Status</th>
                                    <th className="px-5 py-3 font-medium text-slate-600">Type</th>
                                    <th className="px-5 py-3 font-medium text-slate-600">Applicants</th>
                                    <th className="px-5 py-3 font-medium text-slate-600 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {jobs.map((job) => (
                                    <tr key={job.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-5 py-3 font-medium text-slate-900">
                                            <div className="flex flex-col gap-0.5">
                                                <Link href={`/jobs/${job.id}`} className="hover:text-indigo-600 transition-colors">
                                                    {job.title}
                                                </Link>
                                                <div className="flex items-center gap-1.5">
                                                    {job.location && <span className="text-xs text-slate-400">{job.location}</span>}
                                                    {job.visibility === "INSTITUTION_SPECIFIC" && (
                                                        <span className="rounded-full bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600 uppercase tracking-tight">
                                                            Internal
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[job.status]}`}>
                                                {job.status}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-slate-600">{job.jobType.replace("_", " ")}</td>
                                        <td className="px-5 py-3">
                                            <Link href={`/jobs/${job.id}/applications`} className="flex items-center gap-1 text-slate-700 hover:text-slate-900">
                                                <Users className="h-3.5 w-3.5" />
                                                <span>{job._count?.applications ?? 0}</span>
                                                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                                            </Link>
                                        </td>
                                        <td className="px-5 py-3 text-right">
                                            <div className="flex justify-end gap-2">
                                                {job.status === "DRAFT" && (
                                                    <button onClick={() => publishMutation.mutate(job.id)}
                                                        className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100">
                                                        Publish
                                                    </button>
                                                )}
                                                {job.status === "OPEN" && (
                                                    <>
                                                        <button
                                                            onClick={() => openPushModal(job)}
                                                            className="flex items-center gap-1 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                                                        >
                                                            <Send className="h-3 w-3" /> Push
                                                        </button>
                                                        <button onClick={() => closeMutation.mutate(job.id)}
                                                            className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100">
                                                            Close
                                                        </button>
                                                    </>
                                                )}
                                                <button onClick={() => openEdit(job)}
                                                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100">
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </button>
                                                {job.status === "DRAFT" && (
                                                    <button onClick={() => { if (confirm("Delete this job?")) deleteMutation.mutate(job.id); }}
                                                        className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50">
                                                        <Trash2 className="h-3.5 w-3.5" />
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

            {/* Push to Institution Modal */}
            {pushingJob && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl">
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                            <div>
                                <h2 className="font-semibold text-slate-900">Push to Institutions</h2>
                                <p className="text-xs text-slate-500 mt-0.5">"{pushingJob.title}"</p>
                            </div>
                            <button onClick={closePushModal} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="max-h-[60vh] overflow-y-auto px-6 py-4 space-y-5">
                            {/* Available institutions (checkboxes) */}
                            <div>
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                    Available · Select to push
                                </p>
                                {availableInstitutions.length === 0 ? (
                                    <p className="text-sm text-slate-400 italic py-2">All institutions have already been pushed.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {availableInstitutions.map((inst) => {
                                            const checked = selectedIds.has(inst.id);
                                            return (
                                                <label
                                                    key={inst.id}
                                                    className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${checked
                                                        ? "border-indigo-400 bg-indigo-50"
                                                        : "border-slate-200 hover:bg-slate-50"
                                                        }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={() => toggleInstitution(inst.id)}
                                                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 accent-indigo-600"
                                                    />
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium text-slate-800 truncate">{inst.name}</p>
                                                        <p className="text-xs text-slate-500">{inst.domain}</p>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Already pushed */}
                            {existingEntries.length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                        Already Pushed
                                    </p>
                                    <div className="space-y-2">
                                        {existingEntries.map((entry) => (
                                            <div key={entry.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <CheckCircle2 className="h-4 w-4 shrink-0 text-slate-400" />
                                                    <div>
                                                        <p className="text-sm font-medium text-slate-700">{entry.institution.name}</p>
                                                        <p className="text-xs text-slate-400">{entry.institution.domain}</p>
                                                    </div>
                                                </div>
                                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${ENTRY_BADGE[entry.status] ?? "bg-slate-100 text-slate-500"}`}>
                                                    {entry.status.replace("_INSTITUTION", "")}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="border-t border-slate-200 px-6 py-4 flex items-center justify-between gap-3">
                            <span className="text-xs text-slate-500">
                                {selectedIds.size > 0 ? `${selectedIds.size} institution${selectedIds.size > 1 ? "s" : ""} selected` : "Select institutions above"}
                            </span>
                            <div className="flex gap-3">
                                <button onClick={closePushModal}
                                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                                    Cancel
                                </button>
                                <button
                                    onClick={() => pushMutation.mutate()}
                                    disabled={selectedIds.size === 0 || pushMutation.isPending}
                                    className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
                                >
                                    {pushMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                                    Push to {selectedIds.size > 0 ? `${selectedIds.size} ` : ""}Institutions
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </DashboardShell>
    );
}
