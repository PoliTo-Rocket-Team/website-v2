"use client";

import { Work_Sans } from "next/font/google";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ApplyPosition } from "@/app/actions/types";
import { submitApplication } from "@/app/actions/submit-application";
import { useFormStatus } from "react-dom";
import { ShinyButton } from "@/components/ui/shiny-button";

const workSans = Work_Sans({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-work-sans",
});

type ApplyFormProps = {
  position: ApplyPosition;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ShinyButton
      type="submit"
      disabled={pending}
      className="w-full md:w-auto"
    >
      {pending ? "Submitting..." : "Submit Application"}
    </ShinyButton>
  );
}

export function ApplyForm({ position }: ApplyFormProps) {
  return (
    <form action={submitApplication}>
      <input type="hidden" name="positionId" value={position.id} />

      <div className="space-y-6">
        {/* Name */}
        <div>
          <Label htmlFor="name" className={workSans.className}>Name</Label>
          <Input
            id="name"
            name="name"
            type="text"
            required
            className="mt-1 bg-[#0F0F0F] text-white border rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>

        {/* Surname */}
        <div>
          <Label htmlFor="surname" className={workSans.className}>Surname</Label>
          <Input
            id="surname"
            name="surname"
            type="text"
            required
            className="mt-1 bg-[#0F0F0F] text-white border rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>

        {/* Student Number */}
        <div>
          <Label htmlFor="studentNumber" className={workSans.className}>Student Number</Label>
          <Input
            id="studentNumber"
            name="studentNumber"
            type="text"
            required
            className="mt-1 bg-[#0F0F0F] text-white border rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>

        {/* Personal Email */}
        <div>
          <Label htmlFor="email" className={workSans.className}>Personal Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            className="mt-1 bg-[#0F0F0F] text-white border rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>

        {/* Major */}
        <div>
          <Label htmlFor="major" className={workSans.className}>Major</Label>
          <Input
            id="major"
            name="major"
            type="text"
            required
            className="mt-1 bg-[#0F0F0F] text-white border rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>

        {/* Graduation Year */}
        <div>
          <Label htmlFor="graduationYear" className={workSans.className}>Graduation Year</Label>
          <Input
            id="graduationYear"
            name="graduationYear"
            type="number"
            min="2020"
            max="2030"
            required
            className="mt-1 bg-[#0F0F0F] text-white border rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>

        {/* CV Upload */}
        <div>
          <Label htmlFor="cv" className={workSans.className}>CV (PDF)</Label>
          <Input
            id="cv"
            name="cv"
            type="file"
            accept=".pdf"
            required
            className="mt-1 bg-[#0F0F0F] text-white border rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Maximum file size: 10MB
          </p>
        </div>

        {/* Motivation Letter Upload (conditional) */}
        {position.requires_motivation_letter && (
          <div>
            <Label htmlFor="motivation" className={workSans.className}>Motivation Letter (PDF)</Label>
            <Input
              id="motivation"
              name="motivation"
              type="file"
              accept=".pdf"
              required
              className="mt-1 bg-[#0F0F0F] text-white border rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Maximum file size: 10MB
            </p>
          </div>
        )}

        {/* Custom Questions */}
        {position.custom_questions && position.custom_questions.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Additional Questions</h3>
            {position.custom_questions.map((question, index) => (
              <div key={index}>
                <Label htmlFor={`customAnswer-${index}`} className={workSans.className}>{question}</Label>
                <Textarea
                  id={`customAnswer-${index}`}
                  name={`customAnswer-${index}`}
                  required
                  className="mt-1 bg-[#0F0F0F] text-white border rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                  rows={4}
                />
              </div>
            ))}
          </div>
        )}

        {/* Warning Message */}
        <div className="pt-4">
          <p className={`text-sm text-muted-foreground mb-4 text-center ${workSans.className}`}>
            Please be informed that your work will be entirely voluntary. As we are a student team of Politecnico di Torino, we do not offer any paid employment.
          </p>
        </div>

        {/* Submit Button */}
        <div className="pt-2 flex justify-center">
          <SubmitButton />
        </div>
      </div>
    </form>
  );
}

