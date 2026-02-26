"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PortalShell } from "@/components/layout/portal-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Github, Plus, Briefcase, FileCode2, Loader2, Link as LinkIcon } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";

export default function ProfileEditor() {
  const queryClient = useQueryClient();
  const [githubUsername, setGithubUsername] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Claim Form State
  const [type, setType] = useState<"INTERNSHIP" | "PROJECT">("INTERNSHIP");
  const [organization, setOrganization] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data: profile, isLoading } = useQuery({
    queryKey: ["student", "me"],
    queryFn: async () => {
      const { data } = await api.get("/student/me");
      if (data.data.student?.githubUsername) {
        setGithubUsername(data.data.student.githubUsername);
      }
      return data.data.student;
    },
  });

  const updateProfile = useMutation({
    mutationFn: async () => {
      const { data } = await api.put("/student/me", { githubUsername });
      return data;
    },
    onSuccess: () => {
      toast.success("GitHub profile linked successfully");
      queryClient.invalidateQueries({ queryKey: ["student", "me"] });
    },
    onError: () => toast.error("Failed to update profile"),
  });

  const addClaim = useMutation({
    mutationFn: async (e: React.FormEvent) => {
      e.preventDefault();
      const { data } = await api.post("/student/me/claim", {
        type, organization, title, description,
        startDate: new Date(startDate).toISOString(),
        endDate: endDate ? new Date(endDate).toISOString() : null,
      });
      return data;
    },
    onSuccess: () => {
      toast.success("Experience claim added");
      setIsDialogOpen(false);

      // Reset form
      setOrganization(""); setTitle(""); setDescription(""); setStartDate(""); setEndDate("");

      queryClient.invalidateQueries({ queryKey: ["student", "me"] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Failed to add claim"),
  });

  if (isLoading) {
    return (
      <PortalShell>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/3 mb-6"></div>
          <div className="h-32 bg-slate-200 rounded w-full"></div>
          <div className="h-64 bg-slate-200 rounded w-full"></div>
        </div>
      </PortalShell>
    );
  }

  return (
    <PortalShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Build Your Verifiable Profile</h1>
          <p className="mt-1 text-sm text-slate-500">
            Connect your Github and declare your past experiences so recruiters can run algorithmic trust checks.
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
            <div className="flex items-end gap-4 max-w-md">
              <div className="space-y-2 flex-1">
                <Label htmlFor="github">GitHub Username</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                    <LinkIcon className="h-4 w-4" />
                  </div>
                  <Input
                    id="github"
                    placeholder="e.g. torvalds"
                    className="pl-9"
                    value={githubUsername}
                    onChange={(e) => setGithubUsername(e.target.value)}
                  />
                </div>
              </div>
              <Button
                onClick={() => updateProfile.mutate()}
                disabled={profile?.githubUsername === githubUsername || updateProfile.isPending}
              >
                {updateProfile.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </div>
            {profile?.githubUsername && (
              <p className="text-xs text-emerald-600 mt-3 font-medium flex items-center">
                ✓ System linked to github.com/{profile.githubUsername}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Experience Claims */}
        <div className="flex items-center justify-between pt-4">
          <h2 className="text-lg font-semibold text-slate-900">Declared Experiences</h2>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" /> Add Experience
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add New Claim</DialogTitle>
              </DialogHeader>
              <form onSubmit={addClaim.mutate} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Type of Experience</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={type === "INTERNSHIP" ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => setType("INTERNSHIP")}
                    >
                      <Briefcase className="h-4 w-4 mr-2" /> Internship
                    </Button>
                    <Button
                      type="button"
                      variant={type === "PROJECT" ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => setType("PROJECT")}
                    >
                      <FileCode2 className="h-4 w-4 mr-2" /> Project
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="org">{type === "INTERNSHIP" ? "Company / Organization" : "Associated Organization (Optional)"}</Label>
                  <Input id="org" value={organization} onChange={(e) => setOrganization(e.target.value)} required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Title / Role</Label>
                  <Input id="title" placeholder="e.g. Software Engineering Intern" value={title} onChange={(e) => setTitle(e.target.value)} required />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start">Start Date</Label>
                    <Input id="start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end">End Date</Label>
                    <Input id="end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    <span className="text-[10px] text-slate-400">Leave blank if current</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="desc">Summary of Skills Used</Label>
                  <Input id="desc" placeholder="e.g. Built a REST API using Node and TypeScript" value={description} onChange={(e) => setDescription(e.target.value)} required />
                </div>

                <div className="pt-4 flex justify-end">
                  <Button type="submit" disabled={addClaim.isPending}>
                    {addClaim.isPending ? "Saving..." : "Save Claim"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* List of Claims */}
        <div className="space-y-3">
          {profile?.claims?.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center bg-white">
              <h3 className="text-sm font-medium text-slate-900">No experiences declared</h3>
              <p className="mt-1 text-sm text-slate-500">
                Add your internships or projects to verify your skills to recruiters.
              </p>
            </div>
          ) : (
            profile?.claims?.map((claim: any) => (
              <Card key={claim.id} className="shadow-sm border-slate-200 transition-all hover:shadow-md">
                <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-slate-900">{claim.title}</h3>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-slate-600 uppercase">
                        {claim.type}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-700">{claim.organization}</p>
                    <p className="text-xs text-slate-500 mt-1 mb-2">
                      {new Date(claim.startDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })} -
                      {claim.endDate ? new Date(claim.endDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : ' Present'}
                    </p>
                    <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">{claim.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

      </div>
    </PortalShell>
  );
}
