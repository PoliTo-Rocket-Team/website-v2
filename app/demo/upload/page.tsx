//! todo remove unused demo page before production release


"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function UploadDemoPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Demo parameters - in real app these would come from context/props
  const [demoParams, setDemoParams] = useState({
    userId: "user-123",
    applicationId: "1",
    folder: "applications",
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file");
      return;
    }

    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", demoParams.userId);
      formData.append("applicationId", demoParams.applicationId);
      formData.append("folder", demoParams.folder);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setResult(data);
      setFile(null);
      // Reset file input
      const fileInput = document.getElementById(
        "file-input"
      ) as HTMLInputElement;
      if (fileInput) fileInput.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Upload Demo Page</CardTitle>
          <p className="text-sm text-muted-foreground">
            Test the upload API with application files
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Demo Parameters */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Demo Parameters</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="userId">User ID</Label>
                <Input
                  id="userId"
                  value={demoParams.userId}
                  onChange={e =>
                    setDemoParams({ ...demoParams, userId: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="applicationId">Application ID</Label>
                <Input
                  id="applicationId"
                  value={demoParams.applicationId}
                  onChange={e =>
                    setDemoParams({
                      ...demoParams,
                      applicationId: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="folder">Folder</Label>
                <Input
                  id="folder"
                  value={demoParams.folder}
                  onChange={e =>
                    setDemoParams({ ...demoParams, folder: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          {/* File Upload */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">File Upload</h3>
            <div>
              <Label htmlFor="file-input">Select File (Max 50MB)</Label>
              <Input
                id="file-input"
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.txt"
                className="mt-2"
              />
              {file && (
                <div className="mt-2 text-sm text-muted-foreground">
                  Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)}{" "}
                  MB)
                </div>
              )}
            </div>
          </div>

          {/* Upload Button */}
          <Button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full"
          >
            {uploading ? "Uploading..." : "Upload File"}
          </Button>

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-800 font-medium">Error:</p>
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {/* Success Result */}
          {result && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-md">
              <p className="text-green-800 font-medium mb-2">
                Upload Successful!
              </p>
              <div className="text-sm text-green-700 space-y-1">
                <p>
                  <strong>File ID:</strong> {result.file?.id}
                </p>
                <p>
                  <strong>Storage Key:</strong> {result.file?.key}
                </p>
                <p>
                  <strong>Original Filename:</strong>{" "}
                  {result.file?.original_filename}
                </p>
                <p>
                  <strong>MIME Type:</strong> {result.file?.mime_type}
                </p>
                <p>
                  <strong>File Size:</strong> {result.file?.file_size} bytes
                </p>
                <p>
                  <strong>Uploaded At:</strong> {result.file?.uploaded_at}
                </p>
                <p>
                  <strong>ETag:</strong> {result.etag}
                </p>
              </div>
            </div>
          )}

          {/* API Call Preview */}
          <div className="space-y-2">
            <h3 className="text-lg font-medium">API Call Preview</h3>
            <div className="p-4 bg-gray-50 border rounded-md">
              <pre className="text-xs overflow-x-auto">
                {`POST /api/upload
FormData:
- file: ${file ? file.name : "[No file selected]"}
- userId: ${demoParams.userId}
- applicationId: ${demoParams.applicationId}
- folder: ${demoParams.folder}`}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
