"use client";

import { useQuery } from "@tanstack/react-query";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, FileText, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import api from "@/lib/api";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

export default function DashboardHome() {
  const { data: statsData, isLoading: isLoadingStats } = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: async () => {
      const { data } = await api.get("/dashboard/stats");
      return data.data.stats;
    },
  });

  const { data: recentData, isLoading: isLoadingRecent } = useQuery({
    queryKey: ["dashboard", "recent"],
    queryFn: async () => {
      const { data } = await api.get("/dashboard/recent");
      return data.data.recent;
    },
  });

  return (
    <DashboardShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Overview</h1>
          <p className="mt-2 text-sm text-slate-500">
            Real-time credential verification metrics and recent activity.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Total Students</CardTitle>
              <Users className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">
                {isLoadingStats ? "..." : statsData?.totalStudents || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Verifications Ran</CardTitle>
              <FileText className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">
                {isLoadingStats ? "..." : statsData?.totalVerifications || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Pending Review</CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">
                {isLoadingStats ? "..." : statsData?.byStatus?.PENDING || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">High Risk Profiles</CardTitle>
              <AlertTriangle className="h-4 w-4 text-rose-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">
                {isLoadingStats ? "..." : statsData?.byRiskLevel?.HIGH || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity Table */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Verifications</CardTitle>
            <CardDescription>
              The 10 most recently processed credential fraud checks.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingRecent ? (
              <div className="text-sm text-slate-500">Loading recent activity...</div>
            ) : recentData?.length === 0 ? (
              <div className="text-sm text-slate-500">No verifications run yet.</div>
            ) : (
              <div className="relative w-full overflow-auto">
                <table className="w-full caption-bottom text-sm border-collapse">
                  <thead>
                    <tr className="border-b transition-colors hover:bg-slate-50/50">
                      <th className="h-10 px-2 text-left font-medium text-slate-500">Student Name</th>
                      <th className="h-10 px-2 text-left font-medium text-slate-500">Status</th>
                      <th className="h-10 px-2 text-left font-medium text-slate-500">Risk Score</th>
                      <th className="h-10 px-2 text-left font-medium text-slate-500">Analyzed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentData?.map((req: any) => (
                      <tr key={req.id} className="border-b transition-colors hover:bg-slate-50/50">
                        <td className="p-2 align-middle font-medium text-slate-900">
                          <Link href={`/verification/${req.id}`} className="hover:underline">
                            {req.student.user.name}
                          </Link>
                        </td>
                        <td className="p-2 align-middle">
                          {req.status === "COMPLETED" ? (
                            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Evaluated</Badge>
                          ) : req.status === "PENDING" ? (
                            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pending</Badge>
                          ) : (
                            <Badge variant="outline">{req.status}</Badge>
                          )}
                        </td>
                        <td className="p-2 align-middle">
                          {req.result ? (
                            <span className="flex items-center gap-2">
                              {req.result.riskLevel === "LOW" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                              {req.result.riskLevel === "MEDIUM" && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                              {req.result.riskLevel === "HIGH" && <AlertTriangle className="h-4 w-4 text-rose-500" />}
                              {(req.result.overallRiskScore * 100).toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-slate-400">N/A</span>
                          )}
                        </td>
                        <td className="p-2 align-middle text-slate-500">
                          {formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}
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
