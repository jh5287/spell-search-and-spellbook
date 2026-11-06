import AccountProvider from "@/components/AccountProvider";
import SpellApp from "@/components/SpellApp";

export default function Home() {
  return (
    <AccountProvider>
      <SpellApp />
    </AccountProvider>
  );
}
