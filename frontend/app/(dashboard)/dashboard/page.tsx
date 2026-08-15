"use client";

import { useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DashboardHome } from "@/components/dashboard/DashboardHome";
import { useAuth } from "@/context/AuthContext";

export default function DashboardPage() {
  const { refetchUser } = useAuth();

  useEffect(() => {
    refetchUser();
  }, [refetchUser]);

  return (
    <DashboardLayout>
      <DashboardHome />
    </DashboardLayout>
  );
}
