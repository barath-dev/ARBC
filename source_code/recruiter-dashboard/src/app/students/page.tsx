"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, ShieldAlert } from "lucide-react";
import { useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function StudentsPage() {
    const [search, setSearch] = useState("");
    const queryClient = useQueryClient();
    const router = useRouter();

    const { data: students, isLoading } = useQuery({
        queryKey: ["students", search],
        queryFn: async () => {
            // If we had a specific search endpoint, we could use that. Assume standard generic list for now.
            const { data } = await api.get("/student");
            // simple client side filter if the backend doesn't support generic string search yet
            if (!search) return data.data.students || [];
            return (data.data.students || []).filter((s: any) =>
                s.user.name.toLowerCase().includes(search.toLowerCase()) ||
                s.user.email.toLowerCase().includes(search.toLowerCase())
            );
        },
    });

    const triggerVerification = useMutation({
        mutationFn: async (studentId: string) => {
            const { data } = await api.post(`/verification/student/${studentId}`);
            return data;
        },
        onSuccess: (data) => {
            toast.success("Verification triggered successfully!");
            queryClient.invalidateQueries({ queryKey: ["dashboard"] });
            queryClient.invalidateQueries({ queryKey: ["students"] });
            // Redirect to the new verification report
            if (data?.data?.verificationRequest?.id) {
                router.push(`/verification/${data.data.verificationRequest.id}`);
            }
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || "Failed to trigger verification");
        },
    });

    return (
        <DashboardShell>
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Student Profiles</h1>
                    <p className="mt-2 text-sm text-slate-500">
                        Search for student profiles and trigger new ARBC verification checks.
                    </p>
                </div>

                <div className="flex items-center space-x-2 max-w-md">
                    <Input
                        placeholder="Search by name or email..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="bg-white"
                    />
                    <Button variant="secondary" className="shrink-0">
                        <Search className="h-4 w-4 mr-2" />
                        Search
                    </Button>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Directory</CardTitle>
                        <CardDescription>All registered students in the system.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="flex animate-pulse space-x-4">
                                <div className="flex-1 space-y-4 py-1">
                                    <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                                    <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                                </div>
                            </div>
                        ) : students?.length === 0 ? (
                            <p className="text-sm text-slate-500">No students found.</p>
                        ) : (
                            <div className="relative w-full overflow-auto">
                                <table className="w-full caption-bottom text-sm border-collapse">
                                    <thead>
                                        <tr className="border-b transition-colors hover:bg-slate-50/50">
                                            <th className="h-10 px-2 text-left font-medium text-slate-500">Name</th>
                                            <th className="h-10 px-2 text-left font-medium text-slate-500">Email</th>
                                            <th className="h-10 px-2 text-left font-medium text-slate-500">Github</th>
                                            <th className="h-10 px-2 text-right font-medium text-slate-500">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {students?.map((student: any) => (
                                            <tr key={student.id} className="border-b transition-colors hover:bg-slate-50/50">
                                                <td className="p-2 align-middle font-medium text-slate-900">{student.user.name}</td>
                                                <td className="p-2 align-middle">{student.user.email}</td>
                                                <td className="p-2 align-middle text-slate-500">{student.githubUsername || "Not linked"}</td>
                                                <td className="p-2 align-middle text-right">
                                                    <Button
                                                        variant="default"
                                                        size="sm"
                                                        disabled={triggerVerification.isPending}
                                                        onClick={() => triggerVerification.mutate(student.id)}
                                                    >
                                                        {triggerVerification.isPending ? (
                                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                        ) : (
                                                            <ShieldAlert className="h-4 w-4 mr-2" />
                                                        )}
                                                        Run Verification
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardShell>
    );
}
