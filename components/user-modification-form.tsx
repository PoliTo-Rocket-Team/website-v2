"use client";
// import Form from "@/next/form";
import updateUser from "@/app/actions/user/update-user";
import { use, useActionState } from "react";
export function UserModificationForm({}) {
  // const [state, addUser, loading] = useActionState(updateUser);
  const [formState, addUser, isloading] = useActionState(updateUser, null);

  return (
    <section>
      <form action={addUser}>
        <div>
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
        </div>
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
          <input
            type="number"
            name="department_id"
            id="department_id"
            placeholder="Department ID"
            className="border-2 border-gray-300 rounded-md p-2 m-2"
          />
        </section>
        <section className="flex flex-col items-start justify-center">
          <label htmlFor="division">Division</label>
          <input
            type="number"
            name="division"
            id="division"
            placeholder="Division ID"
            className="border-2 border-gray-300 rounded-md p-2 m-2"
          />
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
