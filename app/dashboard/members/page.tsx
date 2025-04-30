import { InfoIcon } from "lucide-react";
import { MembersList } from "@/components/members-list";
import { createClient } from "@/utils/supabase/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Member, Division } from "@/types/team-member-data";
import team_meta_data from "@/app/actions/user/member";
import DivisionMembers from "@/components/division-member";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { UserModificationForm } from "@/components/user-modification-form";

// ----------------------------
export default async function MembersPage() {
  // ----------------------------
  const supabase = await createClient();

  const { data: team, error } = await supabase.rpc("get_subteam_data");
  const newdata = [...team];
  newdata.forEach((member, index, arr) => {
    if (member.division_id == null) {
      member.division_id = 0;
      member.division_name = "Other";
    }
  });
  const division_info = team_meta_data(newdata);

  return (
    <section className="flex flex-col items-center w-full h-full  ">
      <header className="flex items-start flex-col justify-between w-full  my-4 border-b-2 border-gray-300">
        <h2 className="px-[5px] mx-[15px] text-xl  md:text-2xl font-bold">
          member page
        </h2>
        <Sheet>
          <SheetTrigger>Open</SheetTrigger>
          <SheetContent className="min-w-[50vw] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Are you absolutely sure?</SheetTitle>
              <SheetDescription>
                This action cannot be undone. This will permanently delete your
                account and remove your data from our servers.
                <section>
                  <UserModificationForm />
                </section>
              </SheetDescription>
            </SheetHeader>
          </SheetContent>
        </Sheet>
      </header>

      <main className="  w-full h-full flex flex-col items-center justify-center">
        <Tabs
          defaultValue="all"
          className="w-full flex flex-col items-center justify-center  "
        >
          <TabsList
            className=" 
            grid  h-auto grid-cols-1 w-full
            sm:grid-cols-1 sm:w-full

            md:grid-cols-2 min-w-[70%] max-w-[90%]
            lg:grid-cols-3 min-w-[70%] max-w-[90%]
            xl:grid-cols-4 min-w-[70%] max-w-[90%]
            2xl:grid-cols-5 min-w-[70%] max-w-[90%]
            "
          >
            <TabsTrigger value="all" className="font-semibold  ">
              <p>all members</p>
            </TabsTrigger>
            {division_info.map((div) => {
              return (
                <TabsTrigger
                  className="font-semibold"
                  key={div.id}
                  value={`${div.id}`}
                >
                  {div.name}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent
            className="
          w-full h-auto
          sm:w-full sm:h-auto
          lg:max-w-[1000px]
          xl:max-w-[1000px]
          2xl:max-w-[1000px]
          "
            value="all"
          >
            {division_info.map((div) => {
              return (
                <DivisionMembers
                  key={div.id}
                  divisionMembers={[...newdata]}
                  divID={div.id}
                />
              );
            })}
          </TabsContent>

          {division_info.map((div) => {
            return (
              <TabsContent
                className="
              w-full h-auto
              sm:w-full sm:h-auto
              lg:max-w-[1000px]
              xl:max-w-[1000px]
              2xl:max-w-[1000px]
              "
                key={div.id}
                value={`${div.id}`}
              >
                <DivisionMembers divisionMembers={[...team]} divID={div.id} />
              </TabsContent>
            );
          })}
        </Tabs>
      </main>
    </section>
  );
}
