import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { getPostAuthRoute } from "@/lib/navigation/auth";

export default function RegisterScreen() {
  const router = useRouter();
  const { user, signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  useEffect(() => { if (user) router.replace(getPostAuthRoute(user)); }, [router, user]);

  const handleRegister = async () => {
    setError(""); setIsSubmitting(true);
    try { await signUp({ full_name: name.trim(), email: email.trim(), password }); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to create account."); }
    finally { setIsSubmitting(false); }
  };

  return (
    <View className="flex-1 justify-center bg-ink px-6">
      <Text className="text-3xl font-bold text-white">Create your account</Text>
      <Text className="mb-8 mt-2 text-slate-400">Start shaping your next event.</Text>
      <TextInput className="mb-3 rounded-2xl border border-slate-700 bg-panel px-4 py-4 text-white" placeholder="Full name" placeholderTextColor="#78918b" value={name} onChangeText={setName} />
      <TextInput className="mb-3 rounded-2xl border border-slate-700 bg-panel px-4 py-4 text-white" placeholder="Email" placeholderTextColor="#78918b" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput className="rounded-2xl border border-slate-700 bg-panel px-4 py-4 text-white" placeholder="Password" placeholderTextColor="#78918b" secureTextEntry value={password} onChangeText={setPassword} />
      {error ? <Text className="mt-3 text-sm text-red-300">{error}</Text> : null}
      <Pressable className="mt-5 items-center rounded-2xl bg-brand px-4 py-4" onPress={handleRegister} disabled={isSubmitting}>
        {isSubmitting ? <ActivityIndicator color="#07110f" /> : <Text className="font-bold text-ink">Create account</Text>}
      </Pressable>
      <Pressable className="mt-6 items-center" onPress={() => router.back()}><Text className="text-slate-400">Already have an account? <Text className="font-semibold text-brand">Sign in</Text></Text></Pressable>
    </View>
  );
}
