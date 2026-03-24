"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/store";

function AuthLogic({ children }: { children: React.ReactNode }) {
    const { token } = useAuthStore();
    const router = useRouter();
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        if (mounted && !token && !["/login", "/register"].includes(pathname)) {
            router.push("/login");
        }
    }, [token, pathname, router, mounted]);

    if (!mounted) return null;
    if (!token && !["/login", "/register"].includes(pathname)) return null;
    return <>{children}</>;
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
    return (
        <Suspense fallback={null}>
            <AuthLogic>{children}</AuthLogic>
        </Suspense>
    );
}
