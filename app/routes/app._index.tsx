import type {
  LoaderFunctionArgs,
} from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const inquiries = await db.wholesaleInquiry.findMany({
    orderBy: { createdAt: "desc" },
  })

  return { inquiries }
};

export default function Index() {
  const { inquiries } = useLoaderData<typeof loader>();

  const rowMarkup = inquiries.map(
    ({ id, companyName, contactEmail, contactName, status }) => (
      <s-table-row id={id.toString()} key={id}>
        <s-table-cell>{companyName}</s-table-cell>
        <s-table-cell>{contactName}</s-table-cell>
        <s-table-cell>{contactEmail}</s-table-cell>
        <s-table-cell>
          <s-badge tone={status === "PENDING" ? "caution" : "success"}>
            {status}
          </s-badge>
        </s-table-cell>
      </s-table-row>
    ),
  );

  return (
    <s-page heading="Wholesale Data Bridge">
      <s-section heading="Wholesale Data Bridge">
        <s-table>
          <s-table-header-row>
            <s-table-header>Company</s-table-header>
            <s-table-header>Contact</s-table-header>
            <s-table-header>Email</s-table-header>
            <s-table-header>Status</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {rowMarkup}
          </s-table-body>
         </s-table>
      </s-section>
    </s-page>
  );
}
