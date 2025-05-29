"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Clock, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SUBMISSION_DEADLINE = new Date("2025-05-30T15:30:00Z"); // 9 PM IST

const problemStatements = [
  {
    id: "hoichoi",
    title: "SkyRide Cinema Challenge",
    company: "by Hoichoi Technologies",
  },
  {
    id: "lyzr",
    title: "Enterprise AI Cost Optimizer",
    company: "by Lyzr AI",
  },
  {
    id: "aeos",
    title: "VideoVault Comedy Commercial",
    company: "by AEOS Labs",
  },
  {
    id: "opraahfx",
    title: "InfluencerFlow AI Platform",
    company: "by opraahfx",
  },
  {
    id: "hireai",
    title: "HireAI",
    company: "by 100xEngineers x Jaya Talent",
  },
  {
    id: "open",
    title: "Open Problem Statement",
    company: "Submit your own problem statement",
    isOpenProblem: true,
  },
];

export default function ProblemStatementsPage() {
  const [selectedProblem, setSelectedProblem] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [teamSubmission, setTeamSubmission] = useState<any>(null);
  const [isDeadlinePassed, setIsDeadlinePassed] = useState(false);
  const [showOpenProblemDialog, setShowOpenProblemDialog] = useState(false);
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Check if deadline has passed
    setIsDeadlinePassed(new Date() > SUBMISSION_DEADLINE);

    // If user is logged in, check for existing team submission
    if (profile?.team_id) {
      checkTeamSubmission();
    }
  }, [profile]);

  const checkTeamSubmission = async () => {
    if (!profile?.team_id) return;

    try {
      // First check if there's a team submission
      const { data: teamSubmission, error: teamError } = await supabase
        .from("team_problem_submissions")
        .select("*")
        .eq("team_id", profile.team_id)
        .single();

      if (teamError && teamError.code !== "PGRST116") throw teamError; // PGRST116 is "no rows returned"

      if (teamSubmission) {
        setTeamSubmission(teamSubmission);
        setSelectedProblem(teamSubmission.selected_problem);

        // Update the current user's profile if it's not already updated
        if (!profile.problem_submission_locked) {
          const { error: updateError } = await supabase
            .from("profiles")
            .update({
              selected_problem: teamSubmission.selected_problem,
              problem_selected_at: teamSubmission.submitted_at,
              problem_submission_locked: true,
            })
            .eq("id", profile.id);

          if (updateError) {
            console.error("Error updating profile:", updateError);
          }
        }
      }
    } catch (error) {
      console.error("Error checking team submission:", error);
    }
  };

  const updateTeamMembers = async (teamId: string, problemData: any) => {
    try {
      // First, get all team members
      const { data: teamMembers, error: teamError } = await supabase
        .from("profiles")
        .select("id, user_id")
        .eq("team_id", teamId);

      if (teamError) throw teamError;

      if (!teamMembers || teamMembers.length === 0) {
        throw new Error("No team members found");
      }

      // Update all team members' profiles
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          selected_problem: problemData.selected_problem,
          problem_selected_at: problemData.submitted_at,
          problem_submission_locked: true,
        })
        .eq("team_id", teamId);

      if (updateError) throw updateError;

      // Create notifications for all team members except the submitter
      const notifications = teamMembers
        .filter((member) => member.id !== profile?.id)
        .map((member) => ({
          user_id: member.id,
          type: "problem_selected",
          title: "Problem Statement Selected",
          message: `${profile?.user_id} has selected a problem statement for your team`,
          read: false,
        }));

      if (notifications.length > 0) {
        const { error: notificationError } = await supabase
          .from("notifications")
          .insert(notifications);

        if (notificationError) {
          console.error("Error creating notifications:", notificationError);
        }
      }

      return true;
    } catch (error) {
      console.error("Error updating team members:", error);
      throw error;
    }
  };

  const handleSubmit = async () => {
    if (!user || !profile) {
      toast({
        title: "Authentication required",
        description: "Please sign in to select a problem statement",
        variant: "destructive",
      });
      router.push("/login");
      return;
    }

    if (!selectedProblem) {
      toast({
        title: "Selection required",
        description: "Please select a problem statement",
        variant: "destructive",
      });
      return;
    }

    if (isDeadlinePassed) {
      toast({
        title: "Deadline passed",
        description: "The submission deadline has passed",
        variant: "destructive",
      });
      return;
    }

    // If open problem statement is selected, show warning dialog
    if (selectedProblem === "open") {
      setShowOpenProblemDialog(true);
      return;
    }

    setLoading(true);
    try {
      // For team members
      if (profile.team_id) {
        // Check if someone else has already submitted
        const { data: existingSubmission } = await supabase
          .from("team_problem_submissions")
          .select("*")
          .eq("team_id", profile.team_id)
          .single();

        if (existingSubmission) {
          toast({
            title: "Already submitted",
            description: "Your team has already submitted a problem statement",
            variant: "destructive",
          });
          return;
        }

        const submissionData = {
          team_id: profile.team_id,
          selected_problem: selectedProblem,
          submitted_by: profile.id,
          submitted_at: new Date().toISOString(),
        };

        // Create team submission
        const { error: submissionError } = await supabase
          .from("team_problem_submissions")
          .insert(submissionData);

        if (submissionError) throw submissionError;

        // Update all team members' profiles
        await updateTeamMembers(profile.team_id, submissionData);

        toast({
          title: "Success",
          description: "Problem statement selected successfully for your team",
        });
      } else {
        // For individual participants
        const { error } = await supabase
          .from("profiles")
          .update({
            selected_problem: selectedProblem,
            problem_selected_at: new Date().toISOString(),
            problem_submission_locked: true,
          })
          .eq("id", profile.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Problem statement selected successfully",
        });
      }

      // Redirect to applications page
      router.push("/applications");
    } catch (error: any) {
      console.error("Error selecting problem statement:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenProblemSubmit = async () => {
    setLoading(true);
    try {
      // For team members
      if (profile?.team_id) {
        // Check if someone else has already submitted
        const { data: existingSubmission } = await supabase
          .from("team_problem_submissions")
          .select("*")
          .eq("team_id", profile.team_id)
          .single();

        if (existingSubmission) {
          toast({
            title: "Already submitted",
            description: "Your team has already submitted a problem statement",
            variant: "destructive",
          });
          return;
        }

        const submissionData = {
          team_id: profile.team_id,
          selected_problem: "open",
          submitted_by: profile.id,
          submitted_at: new Date().toISOString(),
        };

        // Create team submission
        const { error: submissionError } = await supabase
          .from("team_problem_submissions")
          .insert(submissionData);

        if (submissionError) throw submissionError;

        // Update all team members' profiles
        await updateTeamMembers(profile.team_id, submissionData);

        toast({
          title: "Success",
          description:
            "Open problem statement selected successfully for your team",
        });

        // Open the Tally form in a new tab
        window.open("https://tally.so/r/mBlbMQ", "_blank");
      } else {
        // For individual participants
        const { error } = await supabase
          .from("profiles")
          .update({
            selected_problem: "open",
            problem_selected_at: new Date().toISOString(),
            problem_submission_locked: true,
          })
          .eq("id", profile.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Open problem statement selected successfully",
        });

        // Open the Tally form in a new tab
        window.open("https://tally.so/r/mBlbMQ", "_blank");
      }

      // Redirect to applications page
      router.push("/applications");
    } catch (error: any) {
      console.error("Error selecting open problem statement:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setShowOpenProblemDialog(false);
    }
  };

  if (isDeadlinePassed) {
    return (
      <div className="min-h-screen bg-white dark:bg-background py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              The submission deadline has passed (May 30, 2025, 9 PM IST)
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  if (profile?.problem_submission_locked) {
    return (
      <div className="min-h-screen bg-white dark:bg-background py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              Your problem statement has been submitted and cannot be changed.
              {teamSubmission &&
                ` It was submitted by your team on ${new Date(teamSubmission.submitted_at).toLocaleString()}.`}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-background py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-[#ef5a3c] mb-4">
            Problem Statements
          </h1>
          <p className="text-xl text-muted-foreground">
            Select a problem statement to work on
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Deadline: May 30, 2025, 9 PM IST
          </p>
        </div>

        <Card className="p-6 bg-card/50 backdrop-blur border-[#ef5a3c]/10">
          <RadioGroup
            value={selectedProblem}
            onValueChange={setSelectedProblem}
            className="space-y-4"
          >
            {problemStatements.map((problem) => (
              <div
                key={problem.id}
                className="flex items-start space-x-3 p-4 rounded-lg border border-border hover:border-[#ef5a3c]/20 transition-colors"
              >
                <RadioGroupItem
                  value={problem.id}
                  id={problem.id}
                  className="mt-1"
                />
                <div className="flex-1">
                  <Label
                    htmlFor={problem.id}
                    className="text-lg font-semibold cursor-pointer"
                  >
                    {problem.title}
                  </Label>
                  <p className="text-sm text-muted-foreground mb-1">
                    {problem.company}
                  </p>
                  {problem.isOpenProblem && (
                    <p className="text-sm text-muted-foreground">
                      Click to fill out the form and submit your own problem
                      statement
                    </p>
                  )}
                </div>
                {problem.isOpenProblem && (
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            ))}
          </RadioGroup>

          <div className="mt-8 flex justify-end">
            <Button
              onClick={handleSubmit}
              disabled={loading || !selectedProblem}
              className="bg-[#ef5a3c] hover:bg-[#ef5a3c]/90"
            >
              {loading
                ? "Selecting..."
                : selectedProblem === "open"
                  ? "Open Form"
                  : "Select Problem Statement"}
            </Button>
          </div>
        </Card>

        <Dialog
          open={showOpenProblemDialog}
          onOpenChange={setShowOpenProblemDialog}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Open Problem Statement</DialogTitle>
              <DialogDescription>
                You are about to select an open problem statement. This will:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Lock your problem statement selection</li>
                  <li>
                    Open a form where you need to submit your problem statement
                    details
                  </li>
                  <li>This selection cannot be changed later</li>
                </ul>
                Are you sure you want to proceed?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowOpenProblemDialog(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleOpenProblemSubmit}
                disabled={loading}
                className="bg-[#ef5a3c] hover:bg-[#ef5a3c]/90"
              >
                {loading ? "Processing..." : "Proceed"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
