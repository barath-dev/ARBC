"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PortalShell } from "@/components/layout/portal-shell";
import { Ticket, Copy, Check, Plus, Download, ChevronDown, ChevronRight, Pencil } from "lucide-react";
import api from "@/lib/api";
import { format, formatDistanceToNow } from "date-fns";
import * as XLSX from "xlsx";

// ── export helpers ─────────────────────────────────────────────────────────────

function buildRows(codes: any[]) {
    return codes.map((c) => ({
        Batch: c.batchName ?? `Batch ${c.batchId?.slice(0, 8) ?? "—"}`,
        Code: c.code,
        Status: c.usedById ? "Used" : "Active",
        ExpiresAt: c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : "Never",
        CreatedAt: new Date(c.createdAt).toLocaleString(),
    }));
}

function downloadCSV(codes: any[]) {
    const rows = buildRows(codes);
    const header = Object.keys(rows[0]).join(",");
    const body = rows.map((r) => Object.values(r).join(",")).join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invite-codes-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

function downloadExcel(codes: any[]) {
    const rows = buildRows(codes);
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 22 }, { wch: 20 }, { wch: 10 }, { wch: 14 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Invite Codes");
    XLSX.writeFile(wb, `invite-codes-${Date.now()}.xlsx`);
}

// ── grouping helper ────────────────────────────────────────────────────────────
// Group by batchId (set by backend). Codes without a batchId (legacy) fall into
// a minute-bucketed group so they still render.

type Batch = { key: string; label: string; batchName: string | null; items: any[] };

function groupByBatch(codes: any[]): Batch[] {
    const map = new Map<string, Batch>();
    for (const c of codes) {
        const key = c.batchId ?? (() => {
            const d = new Date(c.createdAt); d.setSeconds(0, 0); return `legacy-${d.toISOString()}`;
        })();
        if (!map.has(key)) {
            map.set(key, {
                key,
                label: format(new Date(c.createdAt), "dd MMM yyyy, hh:mm a"),
                batchName: c.batchName ?? null,
                items: [],
            });
        }
        // Keep batchName in sync (all items in batch share same batchName)
        const batch = map.get(key)!;
        if (c.batchName && !batch.batchName) batch.batchName = c.batchName;
        batch.items.push(c);
    }
    return Array.from(map.values());
}

// ── BatchGroup ─────────────────────────────────────────────────────────────────

function BatchGroup({
    batch,
    onCopy,
    copied,
    onRename,
}: {
    batch: Batch;
    onCopy: (code: string) => void;
    copied: string | null;
    onRename: (batchId: string, name: string) => void;
}) {
    const [open, setOpen] = useState(true);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    const displayName = batch.batchName || `Generated on ${batch.label}`;
    const unused = batch.items.filter((c) => !c.usedById);
    const used = batch.items.filter((c) => c.usedById);

    const startEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        setDraft(batch.batchName ?? `Generated on ${batch.label}`);
        setEditing(true);
        setTimeout(() => inputRef.current?.select(), 0);
    };

    const commitEdit = () => {
        const trimmed = draft.trim();
        if (trimmed) onRename(batch.key, trimmed);
        setEditing(false);
    };

    return (
        <div className="group border border-slate-200 rounded-xl overflow-hidden bg-white">
            {/* Header */}
            <div
                role="button"
                tabIndex={0}
                onClick={() => !editing && setOpen((o) => !o)}
                onKeyDown={(e) => e.key === "Enter" && !editing && setOpen((o) => !o)}
                className="w-full flex items-center justify-between px-5 py-3 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer select-none"
            >
                <div className="flex items-center gap-2.5 min-w-0">
                    {open
                        ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                        : <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />}

                    {editing ? (
                        <input
                            ref={inputRef}
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
                                if (e.key === "Escape") setEditing(false);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded-md border border-indigo-400 bg-white px-2 py-0.5 text-sm font-semibold text-slate-700 outline-none ring-2 ring-indigo-200 w-64"
                            autoFocus
                        />
                    ) : (
                        <span className="text-sm font-semibold text-slate-700 truncate">{displayName}</span>
                    )}

                    {!editing && !batch.key.startsWith("legacy") && (
                        <button
                            onClick={startEdit}
                            title="Rename batch"
                            className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                        >
                            <Pencil className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2 text-xs shrink-0">
                    <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 font-medium">
                        {unused.length} active
                    </span>
                    {used.length > 0 && (
                        <span className="rounded-full bg-slate-200 text-slate-600 px-2 py-0.5 font-medium">
                            {used.length} used
                        </span>
                    )}
                </div>
            </div>

            {/* Codes */}
            {open && (
                <div className="divide-y divide-slate-100">
                    {batch.items.map((c: any) => (
                        <div
                            key={c.id}
                            className={`flex items-center justify-between px-5 py-3 ${c.usedById ? "opacity-50" : ""}`}
                        >
                            <div className="flex items-center gap-3">
                                <code className={`rounded-md px-2.5 py-1 text-sm font-mono ${
                                    c.usedById
                                        ? "bg-slate-100 text-slate-400 line-through"
                                        : "bg-indigo-50 text-indigo-800"
                                }`}>
                                    {c.code}
                                </code>
                                {c.usedById && <span className="text-xs text-slate-400">Used</span>}
                                {!c.usedById && c.expiresAt && (
                                    <span className="text-xs text-slate-500">
                                        expires {formatDistanceToNow(new Date(c.expiresAt), { addSuffix: true })}
                                    </span>
                                )}
                            </div>
                            {!c.usedById && (
                                <button
                                    onClick={() => onCopy(c.code)}
                                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                                >
                                    {copied === c.code
                                        ? <Check className="h-3.5 w-3.5 text-emerald-500" />
                                        : <Copy className="h-3.5 w-3.5" />}
                                    {copied === c.code ? "Copied!" : "Copy"}
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── page ───────────────────────────────────────────────────────────────────────

export default function InvitesPage() {
    const qc = useQueryClient();
    const [copied, setCopied] = useState<string | null>(null);
    const [expiryDays, setExpiryDays] = useState("7");
    const [count, setCount] = useState("1");

    const { data: codes = [], isLoading } = useQuery({
        queryKey: ["institution", "invites"],
        queryFn: async () => {
            const { data } = await api.get("/institutions/me/invite-codes");
            return (data.data.codes ?? []) as any[];
        },
    });

    const generateMutation = useMutation({
        mutationFn: async () => {
            const days = parseInt(expiryDays, 10);
            const payload: Record<string, any> = { count: parseInt(count, 10) };
            if (days > 0) payload.expiresInDays = days;
            return api.post("/institutions/me/invite-codes", payload);
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ["institution", "invites"] }),
    });

    const renameMutation = useMutation({
        mutationFn: async ({ batchId, name }: { batchId: string; name: string }) =>
            api.patch(`/institutions/me/invite-codes/batch/${batchId}`, { name }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["institution", "invites"] }),
    });

    const copyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        setCopied(code);
        setTimeout(() => setCopied(null), 2000);
    };

    const batches = groupByBatch(codes);
    const hasAny = codes.length > 0;

    return (
        <PortalShell>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Invite Codes</h1>
                        <p className="mt-1 text-sm text-slate-500">
                            Generate codes for students to join your institution.
                        </p>
                    </div>
                    {hasAny && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => downloadCSV(codes)}
                                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                            >
                                <Download className="h-4 w-4" />
                                Export CSV
                            </button>
                            <button
                                onClick={() => downloadExcel(codes)}
                                className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
                            >
                                <Download className="h-4 w-4" />
                                Export Excel
                            </button>
                        </div>
                    )}
                </div>

                {/* Generate form */}
                <div className="rounded-xl border border-slate-200 bg-white p-6">
                    <h2 className="font-semibold text-slate-900 mb-4">Generate New Codes</h2>
                    <div className="flex flex-wrap gap-4 items-end">
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1.5">Number of codes</label>
                            <select value={count} onChange={(e) => setCount(e.target.value)}
                                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500">
                                {[1, 5, 10, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1.5">Expires in</label>
                            <select value={expiryDays} onChange={(e) => setExpiryDays(e.target.value)}
                                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500">
                                <option value="0">Never</option>
                                <option value="1">1 day</option>
                                <option value="7">7 days</option>
                                <option value="30">30 days</option>
                                <option value="90">90 days</option>
                            </select>
                        </div>
                        <button
                            onClick={() => generateMutation.mutate()}
                            disabled={generateMutation.isPending}
                            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                        >
                            <Plus className="h-4 w-4" />
                            {generateMutation.isPending ? "Generating…" : "Generate"}
                        </button>
                    </div>
                </div>

                {/* Batches */}
                {isLoading ? (
                    <div className="rounded-xl border border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-400">Loading…</div>
                ) : batches.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white px-5 py-12 text-center">
                        <Ticket className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                        <p className="text-sm text-slate-500">No invite codes yet. Generate some above.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {batches.map((batch) => (
                            <BatchGroup
                                key={batch.key}
                                batch={batch}
                                onCopy={copyCode}
                                copied={copied}
                                onRename={(batchId, name) => renameMutation.mutate({ batchId, name })}
                            />
                        ))}
                    </div>
                )}
            </div>
        </PortalShell>
    );
}
