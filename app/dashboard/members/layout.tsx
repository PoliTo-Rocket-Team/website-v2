export default function MembersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-[99vw] min-h-[calc(100vh-60px)] p-0 m-0 box-border">
      {children}
    </section>
  );
}
