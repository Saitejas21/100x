"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FileUpload } from "@/components/ui/file-upload";
import { MarkdownPreview } from "@/components/ui/markdown-preview";
import { MarkdownHelp } from "@/components/ui/markdown-help";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ProblemType = "llm_agents" | "ai_filmmaking";

export default function SubmitPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [description, setDescription] = useState("");
  const [problemType, setProblemType] = useState<ProblemType>("llm_agents");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !profile) {
      toast({
        title: "Error",
        description: "You must be logged in to submit an application",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Check if team already has a submission
      if (profile.team_id) {
        const { data: teamSubmission, error: teamError } = await supabase
          .from("applications")
          .select("id")
          .eq("team_id", profile.team_id)
          .maybeSingle();

        if (teamError) {
          console.error("Error checking team submission:", teamError);
          toast({
            title: "Error",
            description: "Failed to check team submission",
            variant: "destructive",
          });
          return;
        }

        if (teamSubmission) {
          toast({
            title: "Error",
            description: "Your team has already submitted an application",
            variant: "destructive",
          });
          return;
        }
      }

      if (!screenshotUrl) {
        toast({
          title: "Error",
          description: "Please upload a screenshot/logo of your application",
          variant: "destructive",
        });
        return;
      }

      // Get form data
      const formElement = e.target as HTMLFormElement;
      const formData = new FormData(formElement);

      // Process tags
      const tags =
        formData
          .get("tags")
          ?.toString()
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean) || [];

      // Create the application
      const { data: app, error } = await supabase
        .from("applications")
        .insert({
          title: formData.get("title"),
          description: description,
          url: formData.get("url"),
          screenshot_url: screenshotUrl,
          video_url: formData.get("video_url") || null,
          github_url:
            problemType === "llm_agents" ? formData.get("github_url") : null,
          tags,
          creator_id: profile.id,
          team_id: profile.team_id,
          comments_enabled: true,
          status: "pending",
          problem_type: problemType,
          score: 0,
          review_requested_at: null,
          reviewed_at: null,
        })
        .select()
        .single();

      if (error) throw error;

      // Get all admin users
      const { data: admins, error: adminError } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "admin");

      if (adminError) throw adminError;

      // Create notifications for all admins
      if (admins && admins.length > 0) {
        const adminNotifications = admins.map((admin) => ({
          user_id: admin.id,
          title: "New Application Submission",
          message: `${profile.user_id} submitted "${formData.get(
            "title"
          )}" for review`,
          application_id: app.id,
          type: "submission",
          action_user_id: profile.id,
          read: false,
        }));

        const { error: notificationError } = await supabase
          .from("notifications")
          .insert(adminNotifications);

        if (notificationError) throw notificationError;
      }

      toast({
        title: "Success",
        description: "Your application has been submitted for review",
      });

      router.push("/profile");
    } catch (error) {
      console.error("Error submitting application:", error);
      toast({
        title: "Error",
        description: "Failed to submit application",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-2xl mx-auto text-center">
          <Card className="p-6">
            <h1 className="text-2xl font-bold mb-4">Authentication Required</h1>
            <p className="mb-4">
              You need to be logged in to submit an application.
            </p>
            <Button onClick={() => router.push("/login")}>Go to Login</Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto">
        <Card className="p-6">
          <h1 className="text-3xl font-bold mb-6">Submit Your Application</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="problem_type">Problem Type</Label>
              <Select
                value={problemType}
                onValueChange={(value: ProblemType) => setProblemType(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select problem type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="llm_agents">LLM Agents</SelectItem>
                  <SelectItem value="ai_filmmaking">AI Filmmaking</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Application Name</Label>
              <Input
                id="title"
                name="title"
                placeholder="Enter your application name"
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="description">Description</Label>
                <MarkdownHelp />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Textarea
                  id="description"
                  name="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-[200px]"
                  required
                />
                <div className="border rounded-md p-4">
                  <h3 className="text-sm font-medium mb-2">Preview</h3>
                  <MarkdownPreview content={description} />
                </div>
              </div>
            </div>

            {problemType === "llm_agents" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="url">Application URL</Label>
                  <Input
                    id="url"
                    name="url"
                    type="url"
                    placeholder="https://your-app.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="github_url">GitHub Repository URL</Label>
                  <Input
                    id="github_url"
                    name="github_url"
                    type="url"
                    placeholder="https://github.com/username/repo"
                    required
                  />
                </div>
              </>
            )}

            {problemType === "ai_filmmaking" && (
              <div className="space-y-2">
                <Label htmlFor="url">Project Video URL</Label>
                <Input
                  id="url"
                  name="url"
                  type="url"
                  placeholder="https://your-project.com"
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="video_url">
                  {problemType === "llm_agents"
                    ? "Demo Video"
                    : "Explanation Video"}
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-pointer" />
                    </TooltipTrigger>
                    <TooltipContent>
                      {problemType === "llm_agents" ? (
                        <>
                          Share a Google Drive link to a video demonstrating
                          your application's functionality.
                          <br />
                          <b>
                            Don't forget to give public access to the video you
                            are sharing.
                          </b>
                        </>
                      ) : (
                        "Share a public video link (YouTube, Vimeo, or Loom) showcasing your AI filmmaking project and explaining your approach"
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                id="video_url"
                name="video_url"
                type="url"
                placeholder={
                  problemType === "llm_agents"
                    ? "https://drive.google.com/file/d/your-video-id/view"
                    : "https://drive.google.com/file/d/your-video-id/view"
                }
                required
              />
            </div>

            <div className="space-y-2">
              {/* <Label htmlFor="screenshot">
                {problemType === "llm_agents"
                  ? "App Logo"
                  : "Project Screenshot"}
              </Label> */}
              <FileUpload onUploadComplete={setScreenshotUrl} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags (comma separated)</Label>
              <Input
                id="tags"
                name="tags"
                placeholder="react, typescript, web3"
              />
            </div>

            <div className="flex gap-4">
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit Application"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/profile")}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
