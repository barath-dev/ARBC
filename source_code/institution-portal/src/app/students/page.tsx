"use client";

import { useQuery } from "@tanstack/react-query";
import { PortalShell } from "@/components/layout/portal-shell";
import { Users } from "lucide-react";
import api from "@/lib/api";
import { formatDistanceToNow } from "date-fns";

export default function StudentsPage() {
    const { data: students = [], isLoading } = useQuery({
        queryKey: ["institution", "students"],
        queryFn: async () => {
            const { data } = await api.get("/institutions/me/students");
            return data.data.students as any[];
        },
    });

    return (
        <PortalShell>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Student Cohort</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        {students.length > 0
                            ? `${students.length} student${students.length !== 1 ? "s" : ""} enrolled via invite code.`
                            : "Students who join with your invite codes will appear here."}
                    </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                    {isLoading ? (
                        <div className="px-6 py-12 text-sm text-slate-400 text-center">Loading…</div>
                    ) : students.length === 0 ? (
                        <div className="px-6 py-12 text-center">
                            <Users className="mx-auto h-10 w-10 text-slate-300 mb-3" />
                            <p className="font-medium text-slate-700">No students yet</p>
                            <p className="mt-1 text-sm text-slate-500">Share invite codes from the Invite Codes page.</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="border-b border-slate-200 bg-slate-50 text-left">
                                <tr>
                                    <th className="px-5 py-3 font-medium text-slate-600">Name</th>
                                    <th className="px-5 py-3 font-medium text-slate-600">Email</th>
                                    <th className="px-5 py-3 font-medium text-slate-600">GitHub</th>
                                    <th className="px-5 py-3 font-medium text-slate-600">Joined</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {students.map((s: any) => (
                                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-5 py-3 font-medium text-slate-900">{s.user?.name ?? "—"}</td>
                                        <td className="px-5 py-3 text-slate-600">{s.user?.email ?? "—"}</td>
                                        <td className="px-5 py-3 text-slate-500">
                                            {s.githubUsername ? (
                                                <a
                                                    href={`https://github.com/${s.githubUsername}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-indigo-600 hover:underline"
                                                >
                                                    @{s.githubUsername}
                                                </a>
                                            ) : (
                                                <span className="text-slate-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3 text-slate-500">
                                            {formatDistanceToNow(new Date(s.createdAt), { addSuffix: true })}
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
