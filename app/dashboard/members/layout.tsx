export default function MembersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="w-[99vw] h-[calc(100vh-60px)] bg-gray-500 p-0 m-0 box-border">
      {children}
    </section>
  );
}
