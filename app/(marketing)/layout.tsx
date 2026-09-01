import SharedNav from "@/components/SharedNav";
import SharedFooter from "@/components/SharedFooter";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <SharedNav />
      {children}
      <SharedFooter />
    </div>
  );
}
