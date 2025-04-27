import { getDeptByUserRole, Dept } from "@/app/actions/user/get-dept";
import CreateDialog from "@/components/create-dialog";
import { DeptList } from "@/components/dept-list";

export default async function MembersPage() {
  const depts: { dept: Dept[] } = await getDeptByUserRole();

  return (
    <div>
      <div className="w-full">
        <div className=" flex justify-between px-4 text-foreground">
          <h1 className="text-2xl font-bold">Departments</h1>
          <CreateDialog depts={depts} />
        </div>
        <DeptList depts={depts} />
      </div>
    </div>
  );
}
