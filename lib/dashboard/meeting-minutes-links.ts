import "server-only";

import type { MinutesLinks } from "./meeting-minutes";

// The official links of the Meeting Minutes & Requests page. To add a
// division, add a row; rows show in this order. To add or replace a link, set
// `url` to its full https address (Google Drive for a folder, Google Sheets
// for the Requests Hub). While `url` is null the page says there is no link.
// `name` is the division's full name once it is confirmed, else null, which
// shows the code alone.
//
// This module is server only, so no shared client bundle carries the list.
// The page checks the viewer's reach first, then sends the links to that
// viewer's browser in the page itself (its HTML and Next's inline page data).
// They are no secret from a viewer who reaches the page, or from anyone who
// can read this repository. Google's own sharing settings decide, on their
// own, who can open each one.

export const MINUTES_LINKS: MinutesLinks = {
  folders: [
    { code: "OPS-LGS", name: "Logistics", url: "https://drive.google.com/open?id=1vLtFDzFXRayJloIMuHilLl9i6YdRWKcK" },
    { code: "OPS-SFT", name: "Safety", url: "https://drive.google.com/open?id=1V6ZcSV3wHTRaoml8mYs5ERg7PYD4JbqU" },
    { code: "OPS-MDA", name: null, url: "https://drive.google.com/open?id=14dfmEQEbfjhjw8rNZJmSeB_CDnK0JOtF" },
    { code: "OPS-IT", name: null, url: "https://drive.google.com/open?id=1QALeo6C8mKwrnVq00QEksHmgK_7K2MiF" },
    { code: "VES-RCV", name: null, url: "https://drive.google.com/open?id=1pAdPrPRKW0oUJI9QddYGeBoBXvMkyi1V" },
    { code: "CVR-DAM", name: null, url: "https://drive.google.com/open?id=1Hdu81jT4dilkZIbLC21kXLzPxT2HotCk" },
    { code: "AMV-SAN", name: null, url: "https://drive.google.com/open?id=1en_TsFTP63lNRcye3ci71BEHj02yYnW8" },
    { code: "LRE-LSA", name: "Liquid System Architecture", url: "https://drive.google.com/open?id=1oETxyKW_FiABUElzXnKUfBxFG0XcNnn8" },
  ],
  requestsHub: {
    code: "LST-PRT-001-V4",
    description: "Technical requests and related reports",
    url: "https://docs.google.com/spreadsheets/d/11FAOTOVcSjuRMdcyE-x5BIg6TfYzVjhZCXM1Ol5vlmA",
  },
};
