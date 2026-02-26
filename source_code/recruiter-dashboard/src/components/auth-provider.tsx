"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/store";

export default function AuthProvider({ children }: { children: React.ReactNode }) {
    const { token, user } = useAuthStore();
    const router = useRouter();
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (mounted) {
            if (!token && pathname !== "/login") {
                router.push("/login");
            } else if (token && user?.role !== "RECRUITER" && pathname !== "/login") {
                router.push("/login");
            }
        }
    }, [token, user, pathname, router, mounted]);

    if (!mounted) {
        return null; // Prevent hydration errors
    }

    // Prevent flash of protected content while redirecting
    if (!token && pathname !== "/login") {
        return null;
    }

    return <>{children}</>;
}
