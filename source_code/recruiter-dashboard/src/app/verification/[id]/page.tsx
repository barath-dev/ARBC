"use client";

import { useQuery } from "@tanstack/react-query";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle2, ShieldX, Info, GitCommit, FileText, Building2 } from "lucide-react";
import api from "@/lib/api";
import { use } from "react";

export default function VerificationReport({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);

    const { data: request, isLoading, isError } = useQuery({
        queryKey: ["verification", resolvedParams.id],
        queryFn: async () => {
            const { data } = await api.get(`/verification/${resolvedParams.id}`);
            return data.data.request;
        },
    });

    if (isLoading) {
        return (
            <DashboardShell>
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-slate-200 rounded w-1/4"></div>
                    <div className="h-32 bg-slate-200 rounded w-full"></div>
                </div>
            </DashboardShell>
        );
    }

    if (isError || !request) {
        return (
            <DashboardShell>
                <div className="rounded-md bg-rose-50 p-4">
                    <p className="text-sm font-medium text-rose-800">Error loading verification report.</p>
                </div>
            </DashboardShell>
        );
    }

    const result = request.result;
    const isHighRisk = result?.riskLevel === "HIGH";
    const isMediumRisk = result?.riskLevel === "MEDIUM";

    return (
        <DashboardShell>
            <div className="space-y-6 max-w-6xl mx-auto">
                {/* Header Block */}
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                            Verification Report
                        </h1>
                        <p className="mt-1 text-sm text-slate-500">
                            Run on {new Date(request.createdAt).toLocaleDateString()}
                        </p>
                    </div>

                    <div className="flex flex-col items-end">
                        <div className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">
                            Overall Risk Score
                        </div>
                        {result ? (
                            <div className="flex items-center gap-3">
                                <span className={`text-4xl font-bold ${isHighRisk ? 'text-rose-600' : isMediumRisk ? 'text-amber-500' : 'text-emerald-600'}`}>
                                    {(result.overallRiskScore * 100).toFixed(1)}%
                                </span>
                                {isHighRisk && <ShieldX className="h-8 w-8 text-rose-600" />}
                                {isMediumRisk && <AlertTriangle className="h-8 w-8 text-amber-500" />}
                                {!isHighRisk && !isMediumRisk && <CheckCircle2 className="h-8 w-8 text-emerald-600" />}
                            </div>
                        ) : (
                            <Badge variant="outline" className="text-sm">Pending Analysis</Badge>
                        )}
                    </div>
                </div>

                {/* Algorithms Score Breakdown */}
                {result && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="shadow-sm border-slate-200">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-slate-500">Temporal Consistency</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-slate-900 mb-2">{(result.temporalScore * 100).toFixed(0)}%</div>
                                <Progress value={result.temporalScore * 100} className="h-2" />
                            </CardContent>
                        </Card>
                        <Card className="shadow-sm border-slate-200">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-slate-500">Skills Validation</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-slate-900 mb-2">{(result.skillsScore * 100).toFixed(0)}%</div>
                                <Progress value={result.skillsScore * 100} className="h-2" />
                            </CardContent>
                        </Card>
                        <Card className="shadow-sm border-slate-200">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-slate-500">Document Authenticity</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-slate-900 mb-2">{(result.documentScore * 100).toFixed(0)}%</div>
                                <Progress value={result.documentScore * 100} className="h-2" />
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Detailed Tabs */}
                <Tabs defaultValue="flags" className="w-full">
                    <TabsList className="bg-slate-100/50 p-1 w-full justify-start overflow-x-auto rounded-lg">
                        <TabsTrigger value="flags" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                            <AlertTriangle className="h-4 w-4 mr-2" /> Flags & Inconsistencies
                        </TabsTrigger>
                        <TabsTrigger value="skills" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                            <GitCommit className="h-4 w-4 mr-2" /> Verified Skills
                        </TabsTrigger>
                        <TabsTrigger value="evidence" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                            <FileText className="h-4 w-4 mr-2" /> Raw Evidence
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="flags" className="mt-4 space-y-4">
                        {result?.inconsistencyFlags?.length === 0 ? (
                            <Card className="bg-emerald-50/50 border-emerald-100">
                                <CardContent className="pt-6 text-center text-emerald-800">
                                    <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-400" />
                                    <p className="font-medium">No inconsistencies found across all data sources.</p>
                                </CardContent>
                            </Card>
                        ) : (
                            result?.inconsistencyFlags?.map((flag: any) => (
                                <Card key={flag.id} className="border-l-4 border-l-rose-500 shadow-sm border-y-slate-200 border-r-slate-200">
                                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                                        <div>
                                            <CardTitle className="text-base text-slate-900">{flag.description}</CardTitle>
                                            <CardDescription className="mt-1 flex items-center gap-2">
                                                <Badge variant="outline" className="text-xs">{flag.category}</Badge>
                                                <span className="text-xs text-slate-400">Sources: {flag.evidenceSources.join(", ")}</span>
                                            </CardDescription>
                                        </div>
                                        <Badge className={flag.severity === "HIGH" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"}>
                                            {flag.severity}
                                        </Badge>
                                    </CardHeader>
                                </Card>
                            ))
                        )}
                    </TabsContent>

                    <TabsContent value="skills" className="mt-4 space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Skill Cross-Validation</CardTitle>
                                <CardDescription>Algorithms mapped resume claimed skills to Github repositories</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {result?.skillVerifications?.map((skill: any) => (
                                        <div key={skill.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                                            <div>
                                                <p className="font-medium text-slate-900">{skill.claimedSkill}</p>
                                                <p className="text-xs text-slate-500 mt-1">
                                                    Found in {skill.evidenceRepos.length} repo(s). Confidence: {(skill.confidenceScore * 100).toFixed(0)}%
                                                </p>
                                            </div>
                                            <Badge className={
                                                skill.status === "VERIFIED" ? "bg-emerald-100 text-emerald-800" :
                                                    skill.status === "PARTIAL" ? "bg-amber-100 text-amber-800" :
                                                        "bg-rose-100 text-rose-800"
                                            }>
                                                {skill.status}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="evidence" className="mt-4 space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">GitHub Analysis Snapshot</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <pre className="p-4 bg-slate-900 text-slate-50 rounded-lg text-xs overflow-x-auto">
                                    {JSON.stringify(request.githubAnalysis, null, 2)}
                                </pre>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Document Analysis (OCR Stub)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <pre className="p-4 bg-slate-900 text-slate-50 rounded-lg text-xs overflow-x-auto">
                                    {JSON.stringify(request.documentAnalyses, null, 2)}
                                </pre>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

            </div>
        </DashboardShell>
    );
}
