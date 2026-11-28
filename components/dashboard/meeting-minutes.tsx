import type { ReactNode } from "react";
import { ExternalLink, FileSpreadsheet, FolderOpen } from "lucide-react";
import type { MinutesPage } from "@/lib/dashboard/meeting-minutes";
import { PageHeader, PRIMARY_PILL } from "./page-header";
import { Panel, rowActionClass } from "./panel";

// The Meeting Minutes & Requests page: the divisions' Drive folders, and the
// Requests Hub beside it from lg, under it below. Every link leaves the site,
// so each opens a new tab and says so. A folder or a hub with no link keeps
// its place and says it has none.

const NEW_TAB = " (opens in a new tab)";

export function MeetingMinutesView({ page }: { page: MinutesPage }) {
  const { folders, requestsHub } = page;
  return (
    <>
      <PageHeader title="Meeting Minutes & Requests" intro="Division meeting minutes and the team's Requests Hub." />
      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Panel
          title="Meeting Minutes"
          detail="Google Drive folders, by division."
          meta={folders.length > 0 && `${folders.length} ${folders.length === 1 ? "folder" : "folders"}`}
        >
          {folders.length === 0 && (
            <li className="px-4 py-5 text-[14px] text-prt-muted md:px-5">No meeting minutes yet. Each folder shows here once it is added.</li>
          )}
          {folders.map((folder) => (
            <li key={folder.code} className="flex items-center gap-3 px-4 py-3.5 md:px-5">
              <Mark>
                <FolderOpen aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              </Mark>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium leading-snug [overflow-wrap:anywhere]">{folder.name ?? folder.code}</p>
                {folder.name !== null && <p className="mt-0.5 font-mono text-[11px] text-prt-muted [overflow-wrap:anywhere]">{folder.code}</p>}
              </div>
              {folder.href === null ? (
                <NoLink />
              ) : (
                <a
                  href={folder.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open folder: ${folder.name ?? folder.code}${NEW_TAB}`}
                  className={`${rowActionClass(false)} gap-2`}
                >
                  Open folder
                  <ExternalLink aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                </a>
              )}
            </li>
          ))}
        </Panel>

        <Panel title="Requests Hub" detail="The team's technical requests, in Google Sheets.">
          <li className="px-4 py-4 md:px-5 md:py-5">
            <div className="flex items-center gap-3">
              <Mark>
                <FileSpreadsheet aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              </Mark>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium leading-snug [overflow-wrap:anywhere]">{requestsHub.code}</p>
                <p className="mt-0.5 text-[13px] leading-snug text-prt-muted [overflow-wrap:anywhere]">{requestsHub.description}</p>
              </div>
            </div>
            {requestsHub.href === null ? (
              <p className="mt-4 text-[13px] text-prt-muted">No link yet. The Requests Hub opens from here once it is added.</p>
            ) : (
              <a
                href={requestsHub.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open Requests Hub${NEW_TAB}`}
                className={`${PRIMARY_PILL} mt-4 w-full`}
              >
                Open Requests Hub
                <ExternalLink aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              </a>
            )}
          </li>
        </Panel>
      </div>
      <p className="mt-4 text-[12px] leading-relaxed text-prt-muted">
        Google&apos;s own sharing settings decide who can open each folder and the spreadsheet.
      </p>
    </>
  );
}

/** The icon at the head of a row; the narrowest phones drop it to fit the name. */
function Mark({ children }: { children: ReactNode }) {
  return <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white-5 text-text-2 max-[359px]:hidden">{children}</span>;
}

/** In the place of a folder's button while it has no link. */
function NoLink() {
  return <span className="shrink-0 text-[13px] text-prt-muted">No link yet</span>;
}
