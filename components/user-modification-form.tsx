"use client";

import { useActionState } from "react";
import updateUser from "@/app/actions/user/update-user";

export function UserModificationForm({}) {
  // const [state, addUser, loading] = useActionState(updateUser);

  return (
    <form action={updateUser}>
      <span>
        <label htmlFor="">name</label>
        <input
          type="text"
          name="name"
          id="name"
          placeholder="name"
          className="border-2 border-gray-300 rounded-md p-2 m-2"
        />
      </span>
      <span>
        <label htmlFor="">last name</label>
        <input
          type="text"
          name="lastname"
          id="lastname"
          placeholder="name"
          className="border-2 border-gray-300 rounded-md p-2 m-2"
        />
      </span>
      <button type="submit">submit</button>
      {/* {loading && <p className="bg-red-100">Loading...</p>} */}
    </form>
    // <p className="bg-green-100">
    //   {state?.name} {state?.lastname}
    // </p>
  );
}
