import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import QueryProvider from "@/components/query-provider";
import AuthProvider from "@/components/auth-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "ARBC | Institution Portal",
    description: "TPO Placement Management Portal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body className={`${inter.className} antialiased`} suppressHydrationWarning>
                <QueryProvider>
                    <AuthProvider>
                        {children}
                    </AuthProvider>
                </QueryProvider>
            </body>
        </html>
    );
}
