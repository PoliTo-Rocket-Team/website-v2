import type { NavCounts } from "./access";
import type { AccessGrant, DivisionAccess } from "./division-access";
import type { DivisionOrders, Order } from "./orders";
import type { Overview } from "./overview";
import type { DeleteAccount, MyAccount, MyProfile } from "./self";
import type { DashboardViewer } from "./viewer";
import type { Upload, WriteResult } from "./write";

/**
 * The one way dashboard pages read and write data (issue #141). A test
 * developer gets the dummy arrays (lib/dummy-data/), everyone else the
 * database (./database.ts); ./open.ts picks which and answers a
 * DashboardOpening (./opening.ts). A later page adds one method here and to
 * both implementations.
 *
 * A read answers null when the viewer has nothing on that page (an applicant
 * has no division). A write takes what the browser sent as it came, checks
 * it, and answers a WriteResult (./write.ts); a test developer's write lands
 * nowhere and answers what the page shows next.
 */
export interface DashboardData {
  readonly viewer: DashboardViewer;
  navCounts(): Promise<NavCounts>;
  overview(): Promise<Overview>;

  /** Board 43: the division lead's Access page. */
  divisionAccess(): Promise<DivisionAccess | null>;
  /** One grant per chosen target; answers the grants as the table shows them. */
  giveAccess(input: unknown): Promise<WriteResult<readonly AccessGrant[]>>;
  removeAccess(grantId: number): Promise<WriteResult<null>>;

  /** Board 44: the division lead's Orders page. */
  divisionOrders(): Promise<DivisionOrders | null>;
  /** The New order fields as typed, and the quote when one was attached. */
  placeOrder(fields: Record<string, string>, quote: Upload | null): Promise<WriteResult<Order>>;

  /** Board 45: a team member's own profile. */
  myProfile(): Promise<MyProfile | null>;
  saveLinkedin(text: string): Promise<WriteResult<string | null>>;
  /** A new photo, already cropped square by the browser, or null to remove it. */
  setPhoto(photo: Upload | null): Promise<WriteResult<null>>;
  requestLeave(): Promise<WriteResult<null>>;

  /** Board 45b: an applicant's own account. */
  myAccount(): Promise<MyAccount | null>;
  withdrawApplication(applicationId: number): Promise<WriteResult<null>>;
  /** Removes the sign-in; the rest only as ticked. The page signs out after. */
  deleteAccount(options: DeleteAccount): Promise<WriteResult<null>>;
}
