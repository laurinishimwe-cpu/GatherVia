import { useCallback, useState } from "react";
import { Redirect } from "expo-router";
import { OpeningLogoLoader } from "@/components/OpeningLogoLoader";
import { useAuth } from "@/context/AuthContext";
import { getPostAuthRoute } from "@/lib/navigation/auth";

export default function Index() {
  const { user, isLoading } = useAuth();
  const [animationComplete, setAnimationComplete] = useState(false);
  const handleAnimationComplete = useCallback(() => setAnimationComplete(true), []);

  if (!animationComplete || isLoading) {
    return <OpeningLogoLoader onComplete={handleAnimationComplete} />;
  }

  return <Redirect href={user ? getPostAuthRoute(user) : "/(auth)/login"} />;
}
