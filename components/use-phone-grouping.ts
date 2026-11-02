"use client";

import { useRef, type ChangeEvent, type FocusEvent } from "react";
import { groupPhoneEdit, phoneOnEnter, phoneOnLeave, type DeleteDirection } from "@/lib/phone";

function deleteDirection(event: Event): DeleteDirection | null {
  const type = event instanceof InputEvent ? event.inputType : "";
  if (type === "deleteContentBackward" || type === "deleteWordBackward") return "backward";
  if (type === "deleteContentForward" || type === "deleteWordForward") return "forward";
  return null;
}

/**
 * The handlers that group a phone field's digits as the person types (issue
 * #953), for the application form, Edit details and Your details alike. Each
 * edit writes the grouped value into the field, keeps the caret among the same
 * digits, and hands the value to `onValue` for a form that holds it in state.
 * Nothing runs until the person edits, so a stored phone shows as it is. An
 * empty field gets its `+` on entry and loses it again if left at just that.
 */
export function usePhoneGrouping(onValue?: (value: string) => void) {
  const last = useRef<string | null>(null);
  const put = (input: HTMLInputElement, value: string) => {
    if (value === input.value) return;
    input.value = value;
    onValue?.(value);
  };
  return {
    onFocus: (e: FocusEvent<HTMLInputElement>) => {
      const input = e.currentTarget;
      put(input, phoneOnEnter(input.value));
      last.current = input.value;
    },
    onBlur: (e: FocusEvent<HTMLInputElement>) => {
      const input = e.currentTarget;
      put(input, phoneOnLeave(input.value));
    },
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      const input = e.currentTarget;
      const typed = input.value;
      const edit = groupPhoneEdit(last.current ?? typed, typed, input.selectionStart ?? typed.length, deleteDirection(e.nativeEvent));
      last.current = edit.value;
      if (edit.value !== typed) {
        input.value = edit.value;
        if (document.activeElement === input) input.setSelectionRange(edit.caret, edit.caret);
      }
      onValue?.(edit.value);
    },
  };
}
