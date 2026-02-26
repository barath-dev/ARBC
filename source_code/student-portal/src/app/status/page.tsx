"use client";

import { useQuery } from "@tanstack/react-query";
import { PortalShell } from "@/components/layout/portal-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, XCircle, Shield } from "lucide-react";
import api from "@/lib/api";

export default function StatusPage() {
    const { data: profile, isLoading } = useQuery({
        queryKey: ["student", "me", "status"],
        queryFn: async () => {
            const { data } = await api.get("/student/me");
            return data.data.student;
        },
    });

    if (isLoading) {
        return (
            <PortalShell>
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-slate-200 rounded w-1/3 mb-6"></div>
                    <div className="h-32 bg-slate-200 rounded w-full"></div>
                </div>
            </PortalShell>
        );
    }

    const requests = profile?.verificationRequests || [];

    return (
        <PortalShell>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Verification Status</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Track the progress of background checks initiated by recruiters on your profile.
                    </p>
                </div>

                {requests.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center bg-white flex flex-col items-center">
                        <Shield className="h-12 w-12 text-slate-300 mb-3" />
                        <h3 className="text-sm font-medium text-slate-900">No active verifications</h3>
                        <p className="mt-1 text-sm text-slate-500">
                            When a recruiter requests an algorithmic verification of your credentials, it will appear here.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {requests.map((request: any) => (
                            <Card key={request.id} className="shadow-sm border-slate-200">
                                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle className="text-base font-semibold text-slate-900">
                                            Background Check
                                        </CardTitle>
                                        <CardDescription className="text-xs">
                                            Initiated on {new Date(request.createdAt).toLocaleDateString()}
                                        </CardDescription>
                                    </div>

                                    {request.status === "COMPLETED" ? (
                                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 flex items-center gap-1.5 px-3 py-1">
                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                            Evaluated
                                        </Badge>
                                    ) : request.status === "PENDING" ? (
                                        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 flex items-center gap-1.5 px-3 py-1">
                                            <Clock className="h-3.5 w-3.5" />
                                            In Review
                                        </Badge>
                                    ) : (
                                        <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 flex items-center gap-1.5 px-3 py-1">
                                            <XCircle className="h-3.5 w-3.5" />
                                            Failed
                                        </Badge>
                                    )}
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-slate-600">
                                        {request.status === "COMPLETED"
                                            ? "Your profile algorithms and validations have been processed and returned to the requesting Recruiter."
                                            : request.status === "PENDING"
                                                ? "ARBC is actively cross-referencing your Github contributions and uploaded credentials."
                                                : "An error occurred during the algorithmic analysis of your profile."}
                                    </p>
                                    {request.result && (
                                        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2">
                                            <span className="text-xs font-semibold uppercase text-slate-400">Analysis Check Sum: </span>
                                            <code className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
                                                {request.result.id}
                                            </code>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </PortalShell>
    );
}
