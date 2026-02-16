import nextDynamic from "next/dynamic";

export const dynamic = "force-dynamic";

const ConfirmClient = nextDynamic(() => import("./ConfirmClient"), { ssr: false });

export default function Page() {
  return <ConfirmClient />;
}