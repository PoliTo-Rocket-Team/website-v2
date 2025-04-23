import { Member, Division } from "@/types/team-member-data";

export default function team_meta_data(teamData: Member[]) {
  let subteam: number[] = [];
  let division_info: Division[] = [];
  let department_info: Division[] = [];

  teamData.forEach((user: Member) => {
    if (!subteam.includes(user.division_id)) {
      division_info.push({
        name: user.division_name,
        code: user.division_code,
        id: user.division_id,
      });
      subteam.push(user.division_id);
    }
  });
  return division_info;
}
