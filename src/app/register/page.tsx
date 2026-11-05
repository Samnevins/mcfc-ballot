import { redirect } from "next/navigation";
import { currentUser } from "@/lib/guard";
import { RegisterForm } from "@/components/AuthForm";

export default async function Register() {
  if (await currentUser()) redirect("/");
  return <RegisterForm />;
}
