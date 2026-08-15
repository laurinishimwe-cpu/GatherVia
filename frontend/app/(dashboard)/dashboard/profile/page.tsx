"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/providers/ToastProvider";
import { ApiError, handler } from "@/lib/api/api";

export default function ProfilePage() {
  const router = useRouter();
  const { user, isHydrated, refetchUser, logout } = useAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [isSavingName, setIsSavingName] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  if (!isHydrated || !user) return null;

  const handleSaveName = async () => {
  if (!fullName.trim() || isSavingName) return;
  setIsSavingName(true);
  try {
    await handler("/api/v1/auth/me/profile", {
      method: "PATCH",
      json: { full_name: fullName.trim() },
    });
    await refetchUser();
    toast("Profile updated", "success");
  } catch (error) {
    toast(error instanceof ApiError ? error.message : "Failed to update profile", "error");
  } finally {
    setIsSavingName(false);
  }
};

  const handleChangePassword = async () => {
  setPasswordError("");
  if ((user.has_password && !currentPassword) || !newPassword || !confirmPassword) {
    setPasswordError(
      user.has_password
        ? "All password fields are required."
        : "Enter and confirm your new password.",
    );
    return;
  }
  if (newPassword.length < 8) {
    setPasswordError("New password must be at least 8 characters.");
    return;
  }
  if (newPassword !== confirmPassword) {
    setPasswordError("New passwords do not match.");
    return;
  }
  setIsChangingPassword(true);
  try {
    await handler("/api/v1/auth/me/password", {
      method: "PATCH",
      json: {
        current_password: user.has_password ? currentPassword : undefined,
        new_password: newPassword,
      },
    });
    toast("Password saved. Please sign in again for security.", "success");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    await logout();
    router.replace("/login");
  } catch (error) {
    setPasswordError(error instanceof ApiError ? error.message : "Failed to change password.");
  } finally {
    setIsChangingPassword(false);
  }
};

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl space-y-8 py-8">
        <div>
          <h1 className="text-2xl font-semibold">Manage profile</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Update your display name and change your password.
          </p>
        </div>

        {/* Profile info card */}
        <div className="rounded-2xl border border-brand-400/10 bg-background p-6 space-y-4">
          <h2 className="text-lg font-semibold">Profile information</h2>

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={user.email}
              disabled
              className="w-full rounded-xl border border-brand-400/20 bg-brand-400/5 px-3 py-2.5 text-sm text-foreground/60 outline-none cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Full name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl border border-brand-400/20 bg-background px-3 py-2.5 text-sm outline-none focus:border-brand-400/50"
              placeholder="Your display name"
            />
          </div>

          <button
            onClick={handleSaveName}
            disabled={!fullName.trim() || isSavingName || fullName === user.full_name}
            className="rounded-full bg-brand-400 px-5 py-2.5 text-sm font-semibold text-black transition hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(79,214,190,0.3)] disabled:opacity-40"
          >
            {isSavingName ? "Saving…" : "Save name"}
          </button>
        </div>

        {/* Password card */}
        <div className="rounded-2xl border border-brand-400/10 bg-background p-6 space-y-4">
          <h2 className="text-lg font-semibold">
            {user.has_password ? "Change password" : "Create a password"}
          </h2>

          {!user.has_password && (
            <p className="text-sm leading-6 text-foreground/60">
              Add a password if you also want to sign in with your email address.
            </p>
          )}

          {user.has_password && (
            <div>
              <label className="block text-sm font-medium mb-1">Current password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-xl border border-brand-400/20 bg-background px-3 py-2.5 text-sm outline-none focus:border-brand-400/50"
                placeholder="Enter current password"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-xl border border-brand-400/20 bg-background px-3 py-2.5 text-sm outline-none focus:border-brand-400/50"
              placeholder="At least 8 characters"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Confirm new password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl border border-brand-400/20 bg-background px-3 py-2.5 text-sm outline-none focus:border-brand-400/50"
              placeholder="Re-enter new password"
            />
          </div>

          {passwordError && (
            <p className="text-sm text-red-400">{passwordError}</p>
          )}

          <button
            onClick={handleChangePassword}
            disabled={isChangingPassword}
            className="rounded-full bg-brand-400 px-5 py-2.5 text-sm font-semibold text-black transition hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(79,214,190,0.3)] disabled:opacity-40"
          >
            {isChangingPassword
              ? user.has_password
                ? "Changing…"
                : "Creating…"
              : user.has_password
                ? "Change password"
                : "Create password"}
          </button>
        </div>

        {/* Back button */}
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 text-sm text-foreground/60 hover:text-foreground transition"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to dashboard
        </button>
      </div>
    </DashboardLayout>
  );
}
