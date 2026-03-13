"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/lib/store";

function AuthLogic({ children }: { children: React.ReactNode }) {
    const { token, user } = useAuthStore();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (mounted) {
            const isProcessingOauth = searchParams?.get("github_connected") === "true";
            if (!token && !["/login", "/register"].includes(pathname) && !isProcessingOauth) {
                router.push("/login");
            }
        }
    }, [token, user, pathname, router, mounted, searchParams]);

    if (!mounted) {
        return null;
    }

    const isProcessingOauth = searchParams?.get("github_connected") === "true";
    
    if (!token && !["/login", "/register"].includes(pathname) && !isProcessingOauth) {
        return null;
    }

    return <>{children}</>;
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
    return (
        <Suspense fallback={null}>
            <AuthLogic>{children}</AuthLogic>
        </Suspense>
    );
}
