"use server";

import {
  getEditableDivisions as getEditableDivisionsFromMemberScopes,
  getMemberScopes,
  type ScopeInfo,
} from "./get-member-scopes";

export type { ScopeInfo } from "./get-member-scopes";

export async function getUserScope(targetResource?: string) {
  if (!targetResource) {
    return getMemberScopes();
  }

  return getMemberScopes(targetResource);
}

export async function getEditableDivisions() {
  return getEditableDivisionsFromMemberScopes();
}
