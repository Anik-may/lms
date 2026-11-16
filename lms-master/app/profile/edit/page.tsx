"use client";
import AccountCard from "@/components/AccountCard";
import { PageHeader } from "@/components/ui";

export default function EditProfile() {
  return (
    <>
      <PageHeader title="Edit profile" description="Update how you appear across Institute." />
      <AccountCard />
    </>
  );
}
