"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { PortalShell } from "@/components/layout/portal-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FileCode2, ArrowLeft, Loader2 } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";
import Link from "next/link";

export default function AddProjectPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [organization, setOrganization] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [repoVerifying, setRepoVerifying] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null); // null = no error dialog

  const addProject = useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/student/me/claims", {
        type: "PROJECT",
        company: organization,
        title,
        repoUrl,
        description,
        startDate: new Date(startDate).toISOString(),
        endDate: endDate ? new Date(endDate).toISOString() : null,
      });
      return data;
    },
    onSuccess: () => {
      toast.success("Project added successfully");
      queryClient.invalidateQueries({ queryKey: ["student", "me"] });
      router.push("/");
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Failed to add project"),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // If no repo URL provided, skip validation
    if (!repoUrl.trim()) {
      addProject.mutate();
      return;
    }

    // Validate that the repo belongs to the student
    setRepoVerifying(true);
    try {
      const { data } = await api.get(`/student/me/verify-repo?url=${encodeURIComponent(repoUrl)}`);
      if (!data.data.verified) {
        setRepoError(
          "This repository is not owned by or linked to your GitHub account. " +
          "Only repositories you own or have contributed to can be added for verification."
        );
        return;
      }
      // Verified — proceed with save
      addProject.mutate();
    } catch (err: any) {
      const msg = err.response?.data?.message || "Could not verify the repository. Please check the URL.";
      setRepoError(msg);
    } finally {
      setRepoVerifying(false);
    }
  };

  return (
    <PortalShell>
      {/* Blocking error dialog shown when repo is not linked to the student */}
      <AlertDialog open={!!repoError} onOpenChange={(open) => !open && setRepoError(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              Repository Not Linked to Your Account
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-700 leading-relaxed">
              {repoError}
              <br /><br />
              Please use a repository that your connected GitHub account (<strong>verified identity</strong>) owns or has contributed to.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRepoError(null)}>
              Go Back and Fix URL
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900 transition-colors">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Profile
          </Link>
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <FileCode2 className="h-6 w-6" />
            Add Project
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Declare a project to be verified against your GitHub repositories.
          </p>
        </div>

        <Card className="shadow-sm border-slate-200 max-w-2xl">
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
            <CardDescription>
              If you provide a GitHub repository URL, we will verify you are the owner or a contributor.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="org">Associated Organization (Optional)</Label>
                <Input id="org" placeholder="e.g. Open Source, Company Name" value={organization} onChange={(e) => setOrganization(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="repo">GitHub Repository URL (Optional)</Label>
                <div className="relative">
                  <Input
                    id="repo"
                    type="url"
                    placeholder="https://github.com/username/repo"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                  />
                </div>
                <p className="text-[11px] text-slate-400">Must be a repo you own or have contributed to</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Project Title</Label>
                <Input id="title" placeholder="e.g. Distributed Task Queue" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start">Start Date</Label>
                  <Input id="start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end">End Date</Label>
                  <Input id="end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  <span className="text-[10px] text-slate-400">Leave blank if ongoing</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="desc">Summary of Skills Used</Label>
                <Input id="desc" placeholder="e.g. Built with Node.js, Redis, and TypeScript" value={description} onChange={(e) => setDescription(e.target.value)} required />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <Link href="/">
                  <Button type="button" variant="outline">Cancel</Button>
                </Link>
                <Button type="submit" disabled={repoVerifying || addProject.isPending}>
                  {repoVerifying ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verifying repo...</>
                  ) : addProject.isPending ? (
                    "Saving..."
                  ) : (
                    "Save Project"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </PortalShell>
  );
}
