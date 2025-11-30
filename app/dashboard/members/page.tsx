import { getOrganizationTree } from "@/app/actions/get-members";
import TeamBrowser from "./team-browser";

export default async function MembersPage() {
  const treeData = await getOrganizationTree();
  if (!treeData) {
    return <div>Access Denied or No Data Found</div>;
  }
  return (
    <main className="container py-10">
      <h1 className="text-3xl font-bold mb-8">Team Directory</h1>
      <TeamBrowser data={treeData} />
    </main>
  );
}
