"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApplyPosition } from "@/app/actions/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { submitApplication } from "@/app/actions/submit-application";
import { Upload, Loader2 } from "lucide-react";

type ApplicationFormProps = {
  position: ApplyPosition;
};

export function ApplicationForm({ position }: ApplicationFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [motivationLetter, setMotivationLetter] = useState("");
  const [customAnswers, setCustomAnswers] = useState<string[]>(
    position.custom_questions?.map(() => "") || []
  );

  const handleCvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type (PDF only for now)
      if (file.type !== "application/pdf") {
        toast.error("Invalid file type", {
          description: "Please upload a PDF file for your CV.",
        });
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File too large", {
          description: "Please upload a file smaller than 5MB.",
        });
        return;
      }
      
      setCvFile(file);
    }
  };

  const handleCustomAnswerChange = (index: number, value: string) => {
    const newAnswers = [...customAnswers];
    newAnswers[index] = value;
    setCustomAnswers(newAnswers);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!cvFile) {
      toast.error("CV required", {
        description: "Please upload your CV to continue.",
      });
      return;
    }

    if (position.requires_motivation_letter && !motivationLetter.trim()) {
      toast.error("Motivation letter required", {
        description: "This position requires a motivation letter.",
      });
      return;
    }

    // Check if all custom questions are answered
    if (position.custom_questions && position.custom_questions.length > 0) {
      const unanswered = customAnswers.some(answer => !answer.trim());
      if (unanswered) {
        toast.error("Please answer all questions", {
          description: "All custom questions must be answered.",
        });
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("cv", cvFile);
      formData.append("positionId", position.id.toString());
      formData.append("motivationLetter", motivationLetter);
      formData.append("customAnswers", JSON.stringify(customAnswers));

      const result = await submitApplication(formData);

      if (result.success) {
        toast.success("Application submitted!", {
          description: "Your application has been successfully submitted.",
          duration: 3000,
        });
        
        // Redirect to user dashboard after 1.5 seconds
        setTimeout(() => {
          router.push("/dashboard/applications");
        }, 1500);
      } else {
        toast.error("Submission failed", {
          description: result.error || "Please try again later.",
        });
      }
    } catch (error) {
      console.error("Error submitting application:", error);
      toast.error("An error occurred", {
        description: "Please try again or contact support.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* CV Upload */}
      <div className="space-y-2">
        <Label htmlFor="cv" className="text-base font-semibold">
          Curriculum Vitae (CV) <span className="text-red-500">*</span>
        </Label>
        <p className="text-sm text-muted-foreground mb-2">
          Upload your CV in PDF format (max 5MB)
        </p>
        <div className="relative">
          <Input
            id="cv"
            type="file"
            accept=".pdf"
            onChange={handleCvChange}
            className="cursor-pointer file:cursor-pointer"
            required
          />
          {cvFile && (
            <p className="text-sm text-green-600 mt-2 flex items-center gap-2">
              <Upload className="h-4 w-4" />
              {cvFile.name}
            </p>
          )}
        </div>
      </div>

      {/* Motivation Letter */}
      {position.requires_motivation_letter && (
        <div className="space-y-2">
          <Label htmlFor="motivationLetter" className="text-base font-semibold">
            Motivation Letter <span className="text-red-500">*</span>
          </Label>
          <p className="text-sm text-muted-foreground mb-2">
            Tell us why you're interested in this position
          </p>
          <Textarea
            id="motivationLetter"
            value={motivationLetter}
            onChange={(e) => setMotivationLetter(e.target.value)}
            placeholder="Write your motivation letter here..."
            className="min-h-[200px]"
            required={position.requires_motivation_letter}
          />
        </div>
      )}

      {/* Custom Questions */}
      {position.custom_questions && position.custom_questions.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Additional Questions</h3>
          {position.custom_questions.map((question, index) => (
            <div key={index} className="space-y-2">
              <Label htmlFor={`question-${index}`} className="text-base">
                {index + 1}. {question} <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id={`question-${index}`}
                value={customAnswers[index] || ""}
                onChange={(e) => handleCustomAnswerChange(index, e.target.value)}
                placeholder="Your answer..."
                className="min-h-[100px]"
                required
              />
            </div>
          ))}
        </div>
      )}

      {/* Disclaimer */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <p className="text-sm text-orange-800">
          <strong>Important:</strong> Please be informed that your work will be entirely
          voluntary. As we are a student team of Politecnico di Torino, we do not
          offer any paid employment.
        </p>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end gap-4 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-orange-500 hover:bg-orange-600"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            "Submit Application"
          )}
        </Button>
      </div>
    </form>
  );
}

