"use client";

import { useState, useEffect, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import { PortalShell } from "@/components/layout/portal-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Github, Plus, Briefcase, FileCode2, Loader2, Pencil, Trash2 } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/store";
import Link from "next/link";

function DashboardContent() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (searchParams?.get("github_connected") === "true") {
      const tokenFromUrl = searchParams.get("token");
      if (tokenFromUrl) {
        useAuthStore.getState().setAuth(tokenFromUrl, useAuthStore.getState().user || {
          id: "", name: "", email: "", role: "STUDENT"
        });
      }
      toast.success("GitHub profile connected successfully");
      router.replace("/");
    }
  }, [searchParams, router]);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["student", "me"],
    queryFn: async () => {
      const { data } = await api.get("/student/me");
      return data.data.student;
    },
  });

  const connectGithub = async () => {
    try {
      const { data } = await api.get("/auth/github");
      if (data.data.url) window.location.href = data.data.url;
    } catch {
      toast.error("Failed to initiate GitHub connection");
    }
  };

  const disconnectGithubMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.delete("/student/me/github");
      return data;
    },
    onSuccess: () => {
      toast.success("GitHub account disconnected");
      queryClient.invalidateQueries({ queryKey: ["student", "me"] });
    },
    onError: () => toast.error("Failed to disconnect GitHub account"),
  });

  const deleteClaim = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/student/me/claims/${id}`);
      return data;
    },
    onSuccess: () => {
      toast.success("Claim deleted");
      queryClient.invalidateQueries({ queryKey: ["student", "me"] });
    },
    onError: () => toast.error("Failed to delete claim"),
  });

  const projects = profile?.claims?.filter((c: any) => c.type === "PROJECT") ?? [];
  const experiences = profile?.claims?.filter((c: any) => c.type === "INTERNSHIP") ?? [];

  if (isLoading) {
    return (
      <PortalShell>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/3 mb-6" />
          <div className="h-32 bg-slate-200 rounded w-full" />
          <div className="h-64 bg-slate-200 rounded w-full" />
        </div>
      </PortalShell>
    );
  }

  return (
    <PortalShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Profile</h1>
          <p className="mt-1 text-sm text-slate-500">
            Your verifiable profile. Recruiters will run trust checks against these claims.
          </p>
        </div>

        {/* GitHub Connection */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Github className="h-5 w-5" />
              Developer Portfolio
            </CardTitle>
            <CardDescription>
              We analyze your public repositories to cross-validate the skills you claim.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-md">
              {profile?.githubUsername ? (
                <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-slate-200 rounded-full overflow-hidden">
                      <img src={`https://github.com/${profile.githubUsername}.png`} alt="GitHub Avatar" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{profile.githubUsername}</p>
                      <p className="text-xs text-emerald-600 font-medium">✓ Identity verified</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={connectGithub}>Reconnect</Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => disconnectGithubMutation.mutate()}
                      disabled={disconnectGithubMutation.isPending}
                    >
                      {disconnectGithubMutation.isPending ? "Disconnecting..." : "Disconnect"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-slate-600 mb-4">
                    Connect your GitHub account to enable automatic repository verification for your projects.
                  </p>
                  <Button onClick={connectGithub} className="bg-slate-900 hover:bg-slate-800">
                    <Github className="h-4 w-4 mr-2" />
                    Connect GitHub Account
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Projects Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <FileCode2 className="h-5 w-5 text-slate-500" /> Projects
            </h2>
            <Link href="/projects/add">
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" /> Add Project
              </Button>
            </Link>
          </div>

          {projects.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center bg-white">
              <h3 className="text-sm font-medium text-slate-900">No projects declared</h3>
              <p className="mt-1 text-sm text-slate-500">Add projects to verify your skills to recruiters.</p>
            </div>
          ) : (
            projects.map((claim: any) => (
              <ClaimCard key={claim.id} claim={claim} editHref={`/projects/${claim.id}/edit`} deleteClaim={deleteClaim} />
            ))
          )}
        </div>

        {/* Experience Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-slate-500" /> Experience
            </h2>
            <Link href="/experience/add">
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" /> Add Experience
              </Button>
            </Link>
          </div>

          {experiences.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center bg-white">
              <h3 className="text-sm font-medium text-slate-900">No experience declared</h3>
              <p className="mt-1 text-sm text-slate-500">Add internships or work experience to your profile.</p>
            </div>
          ) : (
            experiences.map((claim: any) => (
              <ClaimCard key={claim.id} claim={claim} editHref={`/experience/${claim.id}/edit`} deleteClaim={deleteClaim} />
            ))
          )}
        </div>
      </div>
    </PortalShell>
  );
}

function ClaimCard({ claim, editHref, deleteClaim }: { claim: any; editHref: string; deleteClaim: any }) {
  return (
    <Card className="shadow-sm border-slate-200 transition-all hover:shadow-md">
      <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-slate-900">{claim.title}</h3>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-slate-600 uppercase">
              {claim.type}
            </span>
          </div>
          {claim.company && <p className="text-sm font-medium text-slate-700">{claim.company}</p>}
          <p className="text-xs text-slate-500 mt-1 mb-2">
            {new Date(claim.startDate).toLocaleDateString(undefined, { month: "short", year: "numeric" })} –
            {claim.endDate ? new Date(claim.endDate).toLocaleDateString(undefined, { month: "short", year: "numeric" }) : " Present"}
          </p>
          <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">{claim.description}</p>
          {claim.repoUrl && (
            <a href={claim.repoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mt-1 block">
              {claim.repoUrl}
            </a>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <Link href={editHref}>
            <Button variant="ghost" size="sm">
              <Pencil className="h-4 w-4 text-slate-500" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm("Are you sure you want to delete this claim?")) {
                deleteClaim.mutate(claim.id);
              }
            }}
            disabled={deleteClaim.isPending}
          >
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProfileDashboard() {
  return (
    <Suspense fallback={
      <PortalShell>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/3 mb-6" />
          <div className="h-32 bg-slate-200 rounded w-full" />
          <div className="h-64 bg-slate-200 rounded w-full" />
        </div>
      </PortalShell>
    }>
      <DashboardContent />
    </Suspense>
  );
}
