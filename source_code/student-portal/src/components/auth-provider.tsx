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
            if (!token && !["/login", "/register"].includes(pathname)) {
                router.push("/login");
            }
        }
    }, [token, user, pathname, router, mounted]);

    if (!mounted) {
        return null;
    }

    if (!token && !["/login", "/register"].includes(pathname)) {
        return null;
    }

    return <>{children}</>;
}
