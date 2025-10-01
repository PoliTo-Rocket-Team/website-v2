"use client";
import updateUser from "@/app/actions/update-user";
import { useState, useActionState } from "react";

export interface Division {
  id: number;
  name: string;
  code: string;
}
export interface Department {
  id: number;
  name: string;
  divisions: Division[];
}

export function UserModificationForm({ department_information }) {
  const [formState, addUser, isloading] = useActionState(updateUser, null);
  const [divisions, setdivisions] = useState([] as Division[]);
  function ondeptChange(e) {
    let new_div: Division[] = [];
    department_information.forEach((dept: Department) => {
      if (dept.id == e.target.value) {
        dept.divisions.forEach((div) => {
          new_div.push(div);
          setdivisions(new_div);
        });
      }
    });
  }
  console.log("department", department_information);

  return (
    <section>
      <form action={addUser}>
        <section className="flex flex-col items-start justify-center">
          <label htmlFor="">name</label>
          <input
            type="text"
            name="name"
            id="name"
            placeholder="name"
            className="border-2 border-gray-300 rounded-md p-2 m-2"
          />
        </section>
        <section className="flex flex-col items-start justify-center">
          <label htmlFor="">last name</label>
          <input
            type="text"
            name="lastname"
            id="lastname"
            placeholder="name"
            className="border-2 border-gray-300 rounded-md p-2 m-2"
          />
        </section>
        <section className="flex flex-col items-start justify-center">
          <label htmlFor="personal_email">Email</label>
          <input
            type="email"
            name="personal_email"
            id="personal_email"
            placeholder=""
            className="border-2 border-gray-300 rounded-md p-2 m-2"
          />
        </section>

        <section className="flex flex-col items-start justify-center">
          <label htmlFor="mobile_number">Mobile Number</label>
          <input
            type="text"
            name="mobile_number"
            id="mobile_number"
            placeholder=""
            className="border-2 border-gray-300 rounded-md p-2 m-2"
          />
        </section>
        <section className="flex flex-col items-start justify-center">
          <label htmlFor="">LinkedIn</label>
          <input
            type="text"
            name="linkedIn"
            id="linkedIn"
            placeholder=""
            className="border-2 border-gray-300 rounded-md p-2 m-2"
          />
        </section>
        <section className="flex flex-col items-start justify-center">
          <label htmlFor="discord">Discord</label>
          <input
            type="text"
            name="discord"
            id="discord"
            placeholder=""
            className="border-2 border-gray-300 rounded-md p-2 m-2"
          />
        </section>
        <section className="flex flex-col items-start justify-center">
          <label htmlFor="level_of_study">Level of Study</label>
          <input
            type="text"
            name="level_of_study"
            id=" level_of_study"
            placeholder=""
            className="border-2 border-gray-300 rounded-md p-2 m-2"
          />
        </section>
        <section className="flex flex-col items-start justify-center">
          <label htmlFor="program">Program</label>
          <input
            type="text"
            name="program"
            id="program"
            placeholder=""
            className="border-2 border-gray-300 rounded-md p-2 m-2"
          />
        </section>
        {/* <section className="flex flex-col items-start justify-center">
          <label htmlFor="program">Program</label>
          <input
            type="text"
            name="program"
            id="program"
            placeholder=""
            className="border-2 border-gray-300 rounded-md p-2 m-2"
          />
        </section> */}
        <section className="flex flex-col items-start justify-center">
          <label htmlFor="department_id">Department</label>

          <select
            name="department_id"
            id="department_id"
            onChange={ondeptChange}
          >
            {department_information.map((department: Department) => {
              return (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              );
            })}
            <option value={""}>No Department</option>
          </select>
        </section>
        <section className="flex flex-col items-start justify-center">
          <label htmlFor="division">Division</label>

          <select name="division_id" id="division_id" defaultValue={""}>
            {divisions.map((div) => {
              return (
                <option key={div.id} value={div.id}>
                  {div.name}
                </option>
              );
            })}
            <option value={""}>No Division</option>
          </select>
        </section>
        <section className="flex flex-col items-start justify-center">
          <label htmlFor="program">Origin</label>
          <input
            type="text"
            name="Origin"
            id="Origin"
            placeholder="Nationality"
            className="border-2 border-gray-300 rounded-md p-2 m-2"
          />
        </section>
        <section className="flex flex-col items-start justify-center">
          <label htmlFor="polito_id">Polito registration number</label>
          <input
            type="text"
            name="polito_id"
            id="polito_id"
            placeholder=" polito registration number"
            className="border-2 border-gray-300 rounded-md p-2 m-2"
          />
        </section>
        <section className="flex flex-col items-start justify-center">
          <label htmlFor="nda_date">nda_date</label>
          <input
            type="date"
            name="nda_date"
            id="nda_date"
            placeholder="Start date of nda"
            className="border-2 border-gray-300 rounded-md p-2 m-2"
          />
        </section>
        <button type="submit">submit</button>
        {formState?.success ? <span>success</span> : <span>not success</span>}
        {isloading && <span className="bg-red-300">loading...</span>}
      </form>
    </section>
  );
}
