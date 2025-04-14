"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { submitApplication } from "@/app/actions/user/submit-application";
// Import shadcn components
import { Form } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";

// Define interface for position data
interface Position {
  id: number;
  title: string;
  description: string;
  required_skills: string[];
  desirable_skills: string[];
  custom_questions: string[];
  division_id: number;
  status: string | boolean;
}

interface FileInfo {
  file: File | null;
  name: string;
}

export default function ApplicationForm() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customAnswers, setCustomAnswers] = useState<{[key: string]: string}>({});
  const [cvFile, setCvFile] = useState<FileInfo>({ file: null, name: "" });
  const [mlFile, setMlFile] = useState<FileInfo>({ file: null, name: "" });
  
  const cvInputRef = useRef<HTMLInputElement>(null);
  const mlInputRef = useRef<HTMLInputElement>(null);

  // Fetch positions on component mount
  useEffect(() => {
    async function fetchPositions() {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        
        // Fetch all positions
        const { data, error } = await supabase
          .from("apply_positions")
          .select("*");

        if (error) {
          throw new Error(error.message);
        }

        // Transform the data to ensure arrays and filter by status
        const formattedData = data
          .filter((pos: any) => pos.status === true || pos.status === "open")
          .map((pos: any) => ({
            ...pos,
            required_skills: Array.isArray(pos.required_skills) ? pos.required_skills : [],
            desirable_skills: Array.isArray(pos.desirable_skills) ? pos.desirable_skills : [],
            custom_questions: Array.isArray(pos.custom_questions) ? pos.custom_questions : [],
          })) as Position[];

        setPositions(formattedData);
        console.log("Fetched positions:", formattedData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load positions");
        console.error("Error fetching positions:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchPositions();
  }, []);

  // Handle position selection
  const handlePositionChange = (positionId: string) => {
    const position = positions.find((p) => p.id.toString() === positionId);
    setSelectedPosition(position || null);
    setCustomAnswers({});
  };

  // Handle file selection for CV
  const handleCvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCvFile({ file, name: file.name });
    }
  };

  // Handle file selection for Motivation Letter
  const handleMlFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setMlFile({ file, name: file.name });
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPosition) {
      setError("Please select a position");
      return;
    }
    
    // Validate that all questions are answered
    const unansweredQuestions = selectedPosition.custom_questions.filter(
      (_, index) => !customAnswers[`question_${index}`]
    );
    
    if (unansweredQuestions.length > 0) {
      setError("Please answer all questions");
      return;
    }

    // Validate file uploads
    if (!cvFile.file) {
      setError("Please upload your CV");
      return;
    }

    if (!mlFile.file) {
      setError("Please upload your Motivation Letter");
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const supabase = createClient();

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        throw new Error("Failed to authenticate user. Please sign in again.");
      }
      
      if (!user) {
        throw new Error("You need to be signed in to apply");
      }

      // Format answers to custom questions
      const formattedAnswers = selectedPosition.custom_questions.map((question, index) => ({
        question,
        answer: customAnswers[`question_${index}`] || "",
      }));

      // Prepare application data
      const applicationData = {
        open_position_id: selectedPosition.id,
        cv_name: cvFile.name,
        ml_name: mlFile.name,
        applied_at: new Date().toISOString(),
        status: "pending",
        custom_answers: formattedAnswers,
        user_id: user.id
      };

      console.log("Submitting application via server action:", applicationData);

      // Submit application using server action
      const result = await submitApplication(applicationData);
      
      if (!result.success) {
        throw new Error(result.error || "Failed to submit application");
      }

      console.log("Application submitted successfully:", result.data);
      setIsSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit application");
      console.error("Error submitting application:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle input changes for custom questions
  const handleInputChange = (questionIndex: number, value: string) => {
    setCustomAnswers(prev => ({
      ...prev,
      [`question_${questionIndex}`]: value
    }));
  };

  if (isSubmitted) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <Alert className="bg-green-50 border-green-200">
          <AlertDescription className="text-green-800 font-medium flex items-center">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="24" 
              height="24" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="h-5 w-5 mr-2 text-green-600"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            Application received! Thank you for applying.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Apply for a Position</h1>
      
      {error && (
        <Alert className="mb-6 bg-red-50 border-red-200">
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        <div>
          <label className="block text-sm font-medium mb-2" htmlFor="position">
            Select Position
          </label>
          <Select
            disabled={loading || isSubmitting}
            onValueChange={handlePositionChange}
            value={selectedPosition?.id.toString()}
          >
            <SelectTrigger id="position">
              <SelectValue placeholder={loading ? "Loading positions..." : "Select a position"} />
            </SelectTrigger>
            <SelectContent>
              {positions.map((position) => (
                <SelectItem key={position.id} value={position.id.toString()}>
                  {position.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedPosition && (
          <>
            {/* Position Description */}
            <Card className="bg-secondary/50">
              <CardHeader>
                <CardTitle className="text-xl">{selectedPosition.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4">{selectedPosition.description}</p>
                
                {/* Required Skills */}
                {selectedPosition.required_skills.length > 0 && (
                  <div className="mb-4">
                    <h3 className="font-medium mb-2">Required Skills</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedPosition.required_skills.map((skill, index) => (
                        <Badge key={index} variant="default">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Desirable Skills */}
                {selectedPosition.desirable_skills.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-2">Desirable Skills</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedPosition.desirable_skills.map((skill, index) => (
                        <Badge key={index} variant="outline">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* File Upload Section */}
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">Application Documents</h2>
              
              <div>
                <Label htmlFor="cv-upload" className="block text-sm font-medium mb-2">
                  CV (PDF)
                </Label>
                <div className="flex items-center gap-3">
                  <input
                    id="cv-upload"
                    ref={cvInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleCvFileChange}
                    className="hidden"
                    disabled={isSubmitting}
                  />
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => cvInputRef.current?.click()}
                    disabled={isSubmitting}
                  >
                    Choose File
                  </Button>
                  <span className="text-sm">
                    {cvFile.name ? cvFile.name : "No file chosen"}
                  </span>
                </div>
              </div>
              
              <div>
                <Label htmlFor="ml-upload" className="block text-sm font-medium mb-2">
                  Motivation Letter (PDF)
                </Label>
                <div className="flex items-center gap-3">
                  <input
                    id="ml-upload"
                    ref={mlInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleMlFileChange}
                    className="hidden"
                    disabled={isSubmitting}
                  />
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => mlInputRef.current?.click()}
                    disabled={isSubmitting}
                  >
                    Choose File
                  </Button>
                  <span className="text-sm">
                    {mlFile.name ? mlFile.name : "No file chosen"}
                  </span>
                </div>
              </div>
            </div>

            {/* Custom Questions */}
            {selectedPosition.custom_questions.length > 0 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold">Application Questions</h2>
                
                {selectedPosition.custom_questions.map((question, index) => (
                  <div key={index} className="space-y-2">
                    <label className="block text-sm font-medium">
                      {question}
                    </label>
                    <Textarea
                      placeholder="Your answer"
                      className="min-h-[100px]"
                      disabled={isSubmitting}
                      value={customAnswers[`question_${index}`] || ""}
                      onChange={(e) => handleInputChange(index, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <svg 
                    className="mr-2 h-4 w-4 animate-spin" 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="24" 
                    height="24" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                  </svg>
                  Submitting...
                </>
              ) : (
                "Submit Application"
              )}
            </Button>
          </>
        )}
      </form>
    </div>
  );
}