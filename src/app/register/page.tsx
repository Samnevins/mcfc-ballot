import { redirect } from "next/navigation";
import { currentUser } from "@/lib/guard";
import { AuthForm } from "@/components/AuthForm";

export default async function Register() {
  if (await currentUser()) redirect("/");
  return <AuthForm mode="register" />;
}
