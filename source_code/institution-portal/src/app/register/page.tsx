"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/lib/store";
import api from "@/lib/api";

export default function RegisterPage() {
    const router = useRouter();
    const setAuth = useAuthStore((s) => s.setAuth);
    const [step, setStep] = useState<"account" | "institution">("account");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Step 1 — account details
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [token, setToken] = useState("");

    // Step 2 — institution details
    const [instName, setInstName] = useState("");
    const [domain, setDomain] = useState("");
    const [logoUrl, setLogoUrl] = useState("");

    const handleStep1 = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            const { data } = await api.post("/auth/register", { name, email, password, role: "INSTITUTION" });
            setToken(data.data.token);
            // Temporarily set auth so the institution creation call is authenticated
            useAuthStore.getState().setAuth(data.data.token, data.data.user);
            setStep("institution");
        } catch (err: any) {
            setError(err.response?.data?.message || "Registration failed");
        } finally {
            setLoading(false);
        }
    };

    const handleStep2 = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            await api.post("/institutions", { name: instName, domain, logoUrl: logoUrl || undefined });
            router.push("/");
        } catch (err: any) {
            setError(err.response?.data?.message || "Institution setup failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
            <div className="w-full max-w-md">
                <div className="mb-8 text-center">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 mb-4">
                        <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zM12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">Register Institution</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Step {step === "account" ? "1" : "2"} of 2 —{" "}
                        {step === "account" ? "Create your account" : "Set up your institution"}
                    </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
                    {error && (
                        <div className="mb-4 rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
                            {error}
                        </div>
                    )}

                    {step === "account" ? (
                        <form onSubmit={handleStep1} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
                                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
                            </div>
                            <button type="submit" disabled={loading}
                                className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                                {loading ? "Creating account…" : "Continue →"}
                            </button>
                            <p className="text-center text-sm text-slate-500">
                                Already registered?{" "}
                                <Link href="/login" className="font-medium text-indigo-600 hover:underline">Sign in</Link>
                            </p>
                        </form>
                    ) : (
                        <form onSubmit={handleStep2} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Institution Name</label>
                                <input type="text" value={instName} onChange={(e) => setInstName(e.target.value)} required
                                    placeholder="e.g. IIT Bombay"
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Domain</label>
                                <input type="text" value={domain} onChange={(e) => setDomain(e.target.value)} required
                                    placeholder="iitb.ac.in"
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Logo URL <span className="text-slate-400 font-normal">(optional)</span></label>
                                <input type="url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)}
                                    placeholder="https://..."
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
                            </div>
                            <button type="submit" disabled={loading}
                                className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                                {loading ? "Setting up…" : "Complete Setup"}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
