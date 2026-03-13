"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useParams } from "next/navigation";
import { PortalShell } from "@/components/layout/portal-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Briefcase, ArrowLeft } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";
import Link from "next/link";

export default function EditExperiencePage() {
  const router = useRouter();
  const params = useParams();
  const claimId = params.id as string;
  const queryClient = useQueryClient();

  const [organization, setOrganization] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data: profile, isLoading } = useQuery({
    queryKey: ["student", "me"],
    queryFn: async () => {
      const { data } = await api.get("/student/me");
      return data.data.student;
    },
  });

  useEffect(() => {
    if (profile?.claims) {
      const claim = profile.claims.find((c: any) => c.id === claimId);
      if (claim) {
        setOrganization(claim.company || claim.organization || "");
        setTitle(claim.title || "");
        setDescription(claim.description || "");
        setStartDate(new Date(claim.startDate).toISOString().split("T")[0]);
        setEndDate(claim.endDate ? new Date(claim.endDate).toISOString().split("T")[0] : "");
      }
    }
  }, [profile, claimId]);

  const updateExperience = useMutation({
    mutationFn: async (e: React.FormEvent) => {
      e.preventDefault();
      const { data } = await api.put(`/student/me/claims/${claimId}`, {
        type: "INTERNSHIP",
        company: organization,
        repoUrl: "",
        title,
        description,
        startDate: new Date(startDate).toISOString(),
        endDate: endDate ? new Date(endDate).toISOString() : null,
      });
      return data;
    },
    onSuccess: () => {
      toast.success("Experience updated successfully");
      queryClient.invalidateQueries({ queryKey: ["student", "me"] });
      router.push("/");
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Failed to update experience"),
  });

  if (isLoading) {
    return (
      <PortalShell>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/3" />
          <div className="h-64 bg-slate-200 rounded w-full max-w-2xl" />
        </div>
      </PortalShell>
    );
  }

  return (
    <PortalShell>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900 transition-colors">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Profile
          </Link>
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Briefcase className="h-6 w-6" />
            Edit Experience
          </h1>
          <p className="mt-1 text-sm text-slate-500">Update your experience details.</p>
        </div>

        <Card className="shadow-sm border-slate-200 max-w-2xl">
          <CardHeader>
            <CardTitle>Experience Details</CardTitle>
            <CardDescription>This will be verified against public GitHub contributions and other signals.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={updateExperience.mutate} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="org">Company / Organization</Label>
                <Input id="org" value={organization} onChange={(e) => setOrganization(e.target.value)} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Title / Role</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
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
                <Input id="desc" value={description} onChange={(e) => setDescription(e.target.value)} required />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <Link href="/"><Button type="button" variant="outline">Cancel</Button></Link>
                <Button type="submit" disabled={updateExperience.isPending}>
                  {updateExperience.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </PortalShell>
  );
}
