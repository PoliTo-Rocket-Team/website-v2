//! todo remove unused demo page before production release

import { auth } from "@/auth";
import { createSupabaseClient } from "@/utils/supabase/client";

export default async function PDFDemoPage() {
  const session = await auth();
  const supabase = await createSupabaseClient();

  // Get some applications with CVs for demonstration
  const { data: applications } = await supabase
    .from("applications")
    .select(
      `
      id,
      user_id,
      cv_file_id,
      cover_letter_file_id,
      users!inner(
        first_name,
        last_name,
        email
      ),
      cv_file:application_files!cv_file_id(
        id,
        r2_key,
        original_filename,
        file_hash
      ),
      cover_letter_file:application_files!cover_letter_file_id(
        id,
        r2_key,
        original_filename,
        file_hash
      )
    `
    )
    .limit(10);

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">PDF Document Access Demo</h1>

      {!session && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-6">
          <p>
            You need to be authenticated to view PDF documents. Please sign in
            to test the functionality.
          </p>
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">How it works:</h2>
        <div className="bg-gray-100 p-4 rounded-lg">
          <p className="text-sm text-gray-700 mb-2">
            PDFs are now served directly through clean URLs using file hash:
          </p>
          <code className="text-sm bg-gray-200 px-2 py-1 rounded">
            /docs/applications/[filehash]/[filename].pdf
          </code>
          <ul className="text-sm text-gray-700 mt-3 list-disc list-inside space-y-1">
            <li>Automatic authentication checks</li>
            <li>Permission validation based on user roles</li>
            <li>Native browser PDF viewing</li>
            <li>Shareable URLs (with permission validation)</li>
          </ul>
        </div>
      </div>

      {applications && applications.length > 0 ? (
        <div>
          <h2 className="text-xl font-semibold mb-4">Sample CV Documents:</h2>
          <div className="space-y-4">
            {applications.map(app => {
              const cvFile = app.cv_file as any;
              console.log("CV File:", cvFile);
              const coverLetterFile = app.cover_letter_file as any;
              console.log("Cover Letter File:", coverLetterFile);

              return (
                <div
                  key={app.id}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-medium">
                        {(app.users as any).first_name}{" "}
                        {(app.users as any).last_name}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {(app.users as any).email}
                      </p>
                      <p className="text-sm text-gray-500">
                        CV ID: {app.cv_file_id || "null"} | Cover Letter ID:{" "}
                        {app.cover_letter_file_id || "null"}
                        <br />
                        CV: {cvFile?.original_filename || "No CV"}
                        {coverLetterFile && (
                          <>
                            {" "}
                            | Cover Letter: {coverLetterFile.original_filename}
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex gap-3">
                      {cvFile && (
                        <>
                          <a
                            href={`/docs/applications/${cvFile.file_hash}/${cvFile.original_filename}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            📄 View CV
                          </a>
                        </>
                      )}
                      {coverLetterFile && (
                        <>
                          <a
                            href={`/docs/applications/${coverLetterFile.file_hash}/${coverLetterFile.original_filename}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-3 py-1.5 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            📄 View Cover Letter
                          </a>
                        </>
                      )}
                    </div>

                    {cvFile && (
                      <div className="text-xs text-gray-500 mt-2">
                        <p>
                          <strong>CV URL:</strong>
                        </p>
                        <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                          {typeof window !== "undefined"
                            ? window.location.origin
                            : "https://yoursite.com"}
                          /docs/applications/
                          {cvFile.file_hash}/{cvFile.original_filename}
                        </code>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-500">
            No applications found with file attachments.
          </p>
          <p className="text-sm text-gray-400 mt-2">
            Make sure you've run:{" "}
            <code className="bg-gray-100 px-2 py-1 rounded">
              supabase db reset
            </code>{" "}
            and{" "}
            <code className="bg-gray-100 px-2 py-1 rounded">pnpm seed:r2</code>
          </p>
          {applications && (
            <details className="mt-4 text-left max-w-2xl mx-auto">
              <summary className="cursor-pointer text-sm text-gray-600">
                Debug: Show raw data ({applications.length} applications found)
              </summary>
              <pre className="mt-2 text-xs bg-gray-50 p-4 rounded overflow-auto max-h-96">
                {JSON.stringify(applications, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}

      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-lg font-medium text-blue-900 mb-2">
          Benefits of This Approach:
        </h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>✅ Clean, shareable URLs</li>
          <li>✅ Native browser PDF controls (zoom, print, download)</li>
          <li>✅ Automatic permission checking</li>
          <li>✅ Works in iframes and embeds</li>
          <li>✅ No separate download API needed</li>
          <li>✅ Better SEO and user experience</li>
        </ul>
      </div>
    </div>
  );
}
