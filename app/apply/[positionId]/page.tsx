"use client";

import {
  applyToPosition,
  checkIfAlreadyApplied,
  createUserFromLocalStorage,
} from "@/app/actions/user/apply-to-position";
import { ApplyPosition } from "@/app/actions/user/get-apply-positions";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/utils/supabase/client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type ApplicationForm = {
  firstName: string;
  lastName: string;
  email: string;
  levelOfStudy: string;
  linkedin: string;
  politoId: string;
  program: string;
  origin: string;
  customAnswers: string[];
};

export default function ApplicationFormPage() {
  const params = useParams();
  const router = useRouter();
  const positionId = parseInt(params.positionId as string);
  
  const [position, setPosition] = useState<ApplyPosition | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [formData, setFormData] = useState<ApplicationForm>({
    firstName: "",
    lastName: "",
    email: "",
    levelOfStudy: "",
    linkedin: "",
    politoId: "",
    program: "",
    origin: "",
    customAnswers: [],
  });

  useEffect(() => {
    loadPosition();
    checkAuthStatus();
    loadLocalStorageData();
  }, [positionId]);

  const loadPosition = async () => {
    try {
      const supabase = createClient();
      const { data: positionData } = await supabase
        .from("apply_positions")
        .select(`
          *,
          divisions(
            *,
            departments(name)
          )
        `)
        .eq("id", positionId)
        .single();

      if (positionData) {
        setPosition(positionData as ApplyPosition);
        setFormData(prev => ({
          ...prev,
          customAnswers: new Array(positionData.custom_questions?.length || 0).fill(""),
        }));
      }

      const { hasApplied: applied } = await checkIfAlreadyApplied(positionId);
      setHasApplied(applied);
    } catch (error) {
      console.error("Error loading position:", error);
      setMessage({ type: 'error', text: 'Failed to load position details.' });
    } finally {
      setLoading(false);
    }
  };

  const checkAuthStatus = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    setIsAuthenticated(!!user);

    // If logged in, check if any user data exists and pre-fill
    if (user) {
      const { data: userData } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single();

      if (userData) {
        // Pre-fill the anagraphical data of user in the application form
        setFormData(prev => ({
          ...prev,
          firstName: userData.first_name || "",
          lastName: userData.last_name || "",
          email: userData.email || "",
          levelOfStudy: userData.level_of_study || "",
          linkedin: userData.linkedin || "",
          politoId: userData.polito_id || "",
          program: userData.program || "",
          origin: userData.origin || "",
        }));
      }
    }
  };

  const loadLocalStorageData = () => {
    const savedData = localStorage.getItem("applicationFormData");
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setFormData(prev => ({ ...prev, ...parsed }));
      } catch (error) {
        console.error("Error parsing localStorage data:", error);
      }
    }
  };

  const saveToLocalStorage = () => {
    localStorage.setItem("applicationFormData", JSON.stringify(formData));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!position) return;

    setSubmitting(true);

    try {
      // Check if logged in?
      if (!isAuthenticated) {
        // Store response to local storage
        saveToLocalStorage();
        setMessage({ type: 'success', text: 'Application saved. Please log in with Google to submit.' });
        
        // Redirect to Google Login
        setTimeout(() => {
          window.location.href = `/sign-in?redirect=/apply/${positionId}`;
        }, 2000);
        return;
      }

      // User is logged in - check if user already in database
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setMessage({ type: 'error', text: 'Authentication error. Please try again.' });
        return;
      }

      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("id", user.id)
        .single();

      if (!existingUser) {
        // Get responses from local storage for user data
        const savedData = localStorage.getItem("applicationFormData");
        let userData = formData;
        
        if (savedData) {
          try {
            userData = { ...formData, ...JSON.parse(savedData) };
          } catch (error) {
            console.error("Error parsing localStorage data:", error);
          }
        }

        // Add Record in public.users
        await createUserFromLocalStorage({
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          levelOfStudy: userData.levelOfStudy,
          linkedin: userData.linkedin,
          politoId: userData.politoId,
          program: userData.program,
          origin: userData.origin,
        });
      }

      // Add record to public.applications
      const result = await applyToPosition({
        positionId: position.id,
        customAnswers: formData.customAnswers,
      });

      if (result.error) {
        setMessage({ type: 'error', text: result.error });
      } else {
        setMessage({ type: 'success', text: 'Your application has been submitted successfully!' });
        localStorage.removeItem("applicationFormData");
        
        setTimeout(() => {
          router.push('/apply');
        }, 2000);
      }
    } catch (error) {
      console.error("Error submitting application:", error);
      setMessage({ type: 'error', text: 'Failed to submit application. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  if (!position) {
    return <div className="text-muted-foreground p-4">Position not found.</div>;
  }

  if (hasApplied) {
    return (
      <div className="w-full">
        <Card>
          <CardHeader>
            <CardTitle>Already Applied</CardTitle>
            <CardDescription>
              You have already submitted an application for this position.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center">
              <Button 
                onClick={() => router.push('/apply')} 
                className="bg-orange-500 text-white hover:bg-orange-600"
              >
                Back to Positions
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-center mb-6 text-primary">
        Apply to {position.title}
      </h2>

      {message && (
        <div className={`mb-4 p-4 rounded-md ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' 
            : 'bg-red-50 text-red-800 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
        }`}>
          {message.text}
        </div>
      )}

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <Accordion type="multiple" defaultValue={["personal", "academic", "questions"]} className="w-full">
              
              {/* Personal Information Section */}
              <AccordionItem value="personal">
                <AccordionTrigger className="text-lg font-semibold">
                  Personal Information
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        First Name *
                      </label>
                      <input
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={formData.firstName}
                        onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                        placeholder="Enter your first name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        Last Name *
                      </label>
                      <input
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={formData.lastName}
                        onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                        placeholder="Enter your last name"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Email *
                    </label>
                    <input
                      type="email"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="Enter your email address"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Country of Origin
                    </label>
                    <input
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={formData.origin}
                      onChange={(e) => setFormData(prev => ({ ...prev, origin: e.target.value }))}
                      placeholder="Enter your country of origin"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      LinkedIn Profile
                    </label>
                    <input
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={formData.linkedin}
                      onChange={(e) => setFormData(prev => ({ ...prev, linkedin: e.target.value }))}
                      placeholder="https://linkedin.com/in/yourprofile"
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Academic Information Section */}
              <AccordionItem value="academic">
                <AccordionTrigger className="text-lg font-semibold">
                  Academic Information
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        Level of Study
                      </label>
                      <input
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={formData.levelOfStudy}
                        onChange={(e) => setFormData(prev => ({ ...prev, levelOfStudy: e.target.value }))}
                        placeholder="e.g., Bachelor's, Master's, PhD"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        Program
                      </label>
                      <input
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={formData.program}
                        onChange={(e) => setFormData(prev => ({ ...prev, program: e.target.value }))}
                        placeholder="Your study program"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      PoliTO ID
                    </label>
                    <input
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={formData.politoId}
                      onChange={(e) => setFormData(prev => ({ ...prev, politoId: e.target.value }))}
                      placeholder="Your Politecnico di Torino ID"
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Position-Specific Questions Section */}
              {position.custom_questions && position.custom_questions.length > 0 && (
                <AccordionItem value="questions">
                  <AccordionTrigger className="text-lg font-semibold">
                    Position-Specific Questions
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    {position.custom_questions.map((question, index) => (
                      <div key={index} className="space-y-2">
                        <label className="text-sm font-medium text-foreground">
                          {question}
                        </label>
                        <textarea
                          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          rows={3}
                          value={formData.customAnswers[index] || ""}
                          onChange={(e) => {
                            const newAnswers = [...formData.customAnswers];
                            newAnswers[index] = e.target.value;
                            setFormData(prev => ({ ...prev, customAnswers: newAnswers }));
                          }}
                          placeholder="Please provide your answer here..."
                        />
                      </div>
                    ))}
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>

            {/* Submit Section */}
            <div className="flex justify-center space-x-4 pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/apply')}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || !formData.firstName || !formData.lastName || !formData.email}
                className="bg-orange-500 text-white hover:bg-orange-600"
              >
                {submitting ? "Submitting..." : "Submit Application"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
} 