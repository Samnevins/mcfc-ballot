import { redirect } from "next/navigation";
import { currentUser } from "@/lib/guard";
import { LoginForm } from "@/components/AuthForm";

export default async function Login() {
  if (await currentUser()) redirect("/");
  return <LoginForm />;
}
