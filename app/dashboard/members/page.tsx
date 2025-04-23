import { InfoIcon } from "lucide-react";
import { MembersList } from "@/components/members-list";
import { createClient } from "@/utils/supabase/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Member = {
  first_name: string;
  last_name: string;
  role_type: string;
  member_id: number;
  role_id: number;
  email: string;
  linkedin: string | null;
  role_title: string;
  division_id: number;
  department_id: number;
  discord: string | null;
  origin: string;
  level_of_study: string | null;
  polito_id: number | null;
  program: string | null;
  started_at: string; // Could use Date if you're parsing it later
  mobile_number: string | null;
  division_name: string;
  division_code: string;
  departments_name: string;
  department_code: string;
};

type Division = {
  name: string;
  code: string;
  id: number;
};

export default async function MembersPage() {
  const supabase = await createClient();

  // const { data, error } = await supabase.rpc("get_user_info");
  // console.log("data", data);
  // console.log("error", error);
  // ---------------------
  const { data, error } = await supabase.rpc("get_subteam_data");
  console.log("data", data);
  console.log("error", error);

  let subteam: string[] = [];
  let dept = [];
  let division_info: Division[] = [];
  let department_info: Division[] = [];
  let team: Member[] = data as Member[];

  data.forEach((user) => {
    if (!subteam.includes(user.division_id)) {
      division_info.push({
        name: user.division_name,
        code: user.division_code,
        id: user.division_id,
      });
      subteam.push(user.division_id);
      if (!department_info.includes(user.department_id)) {
        department_info.push({
          name: user.departments_name,
          code: user.department_code,
          id: user.department_id,
        });
      }
    }
  });

  // console.log("divisions : " , division_info );
  // console.log("departments :" , department_info);

  return (
    <>
      <h2 className="px-[5px] mx-[15px]">member page</h2>
      <main className="px-[5px] mx-[15px]">
        <Tabs defaultValue="account" className="w-[400px]">
          <TabsList>
            {division_info.map((div) => {
              return (
                <TabsTrigger key={div.id} value={`${div.id}`}>
                  {div.name}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {division_info.map((div) => {
            return (
              <TabsContent key={div.id} value={`${div.id}`}>
                <ul>
                  {team.map((member) => {
                    if (member.division_id === div.id) {
                      return (
                        <li key={member.member_id}>
                          <p>{member.first_name}</p>
                        </li>
                      );
                    }
                  })}
                </ul>
              </TabsContent>
            );
          })}
        </Tabs>
      </main>
    </>
  );
}
