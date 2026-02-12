import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const inquiries = await db.wholesaleInquiry.findMany({
    orderBy: { createdAt: "desc" },
  });

  return { inquiries };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const id = Number(formData.get("id"));
  const email = formData.get("email")?.toString();
  const name = formData.get("name")?.toString();
  const company = formData.get("company")?.toString();

  if (!id || !email || !name || !company) {
    return { error: "Missing required form data" };
  }

  try {
    const response = await admin.graphql(
      `#graphql
        mutation customerCreate($input: CustomerInput!) {
          customerCreate(input: $input) {
            customer {
              id
            }
            userErrors {
              field
              message
            }
          }
        }
      `,
      {
        variables: {
          input: {
            email,
            firstName: name,
            lastName: "(wholesale)",
            note: `Company: ${company}`,
            tags: ["Wholesale", "Inquiry-Approved"],
          },
        },
      },
    );

    const responseJson = (await response.json()) as any;
    const graphQLErrors = responseJson.errors ?? [];
    if (graphQLErrors.length > 0) {
      return { error: graphQLErrors[0]?.message ?? "GraphQL request failed" };
    }

    const userErrors = responseJson.data?.customerCreate?.userErrors ?? [];

    if (userErrors.length > 0) {
      return { errors: userErrors };
    }

    await db.wholesaleInquiry.update({
      where: { id },
      data: { status: "APPROVED" },
    });

    return { success: true };
  } catch (error) {
    console.error("Approve action failed", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown server error";
    return { error: `Something went wrong: ${errorMessage}` };
  }
};

export default function Index() {
  const fetcher = useFetcher<typeof action>();
  const { inquiries } = useLoaderData<typeof loader>();

  const rowMarkup = inquiries.map(
    ({ id, companyName, contactEmail, contactName, status }) => {
      const isApproving =
        fetcher.state !== "idle" && fetcher.formData?.get("id") === String(id);

      return (
        <s-table-row id={id.toString()} key={id}>
          <s-table-cell>{companyName}</s-table-cell>
          <s-table-cell>{contactName}</s-table-cell>
          <s-table-cell>{contactEmail}</s-table-cell>
          <s-table-cell>
            <s-badge tone={status === "PENDING" ? "caution" : "success"}>
              {status}
            </s-badge>
          </s-table-cell>
          <s-table-cell>
            {status === "PENDING" ? (
              <s-button
                type="button"
                variant="primary"
                loading={isApproving}
                onClick={() =>
                  fetcher.submit(
                    {
                      id: String(id),
                      email: contactEmail,
                      name: contactName,
                      company: companyName,
                    },
                    { method: "post" },
                  )
                }
              >
                Approve
              </s-button>
            ) : (
              <s-text>Approved</s-text>
            )}
          </s-table-cell>
        </s-table-row>
      );
    },
  );

  return (
    <s-page heading="Wholesale Data Bridge">
      <s-section heading="Wholesale inquiries">
        {fetcher.data?.error ? (
          <s-banner tone="critical">{fetcher.data.error}</s-banner>
        ) : null}
        {fetcher.data?.errors?.length ? (
          <s-banner tone="critical">
            {fetcher.data.errors[0]?.message ?? "Customer creation failed"}
          </s-banner>
        ) : null}
        <s-table>
          <s-table-header-row>
            <s-table-header>Company</s-table-header>
            <s-table-header>Contact</s-table-header>
            <s-table-header>Email</s-table-header>
            <s-table-header>Status</s-table-header>
            <s-table-header>Action</s-table-header>
          </s-table-header-row>
          <s-table-body>{rowMarkup}</s-table-body>
        </s-table>
      </s-section>
    </s-page>
  );
}
