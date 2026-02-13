import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const isE2E = process.env.E2E_TEST_MODE === "true";
  if (!isE2E) await authenticate.admin(request);

  const inquiries = await db.wholesaleInquiry.findMany({
    orderBy: { createdAt: "desc" },
  });

  return { inquiries };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const isE2E = process.env.E2E_TEST_MODE === "true";
  const admin = isE2E ? null : (await authenticate.admin(request)).admin;

  const formData = await request.formData();
  const id = Number(formData.get("id"));
  if (!id) return { error: "Missing inquiry id" };

  const inquiry = await db.wholesaleInquiry.findUnique({ where: { id } });
  if (!inquiry) return { error: "Inquiry not found" };

  if (inquiry.status === "APPROVED") {
    return { error: "This inquiry is already approved" };
  }

  if (isE2E) {
    await db.wholesaleInquiry.update({
      where: { id: inquiry.id },
      data: { status: "APPROVED" },
    });
    return { success: true };
  }

  try {
    const customerInput = {
      email: inquiry.email,
      firstName: inquiry.firstName,
      lastName: inquiry.lastName,
      phone: inquiry.phoneNumber,
      note: `Company: ${inquiry.companyName}`,
      tags: ["Wholesale", "Inquiry-Approved"],
    };

    const findResponse = await admin!.graphql(
      `#graphql
        query FindCustomerByEmail($query: String!) {
          customers(first: 1, query: $query) {
            nodes {
              id
            }
          }
        }
      `,
      { variables: { query: `email:${inquiry.email}` } },
    );

    const findJson = (await findResponse.json()) as any;
    const findGraphQLErrors = findJson.errors ?? [];
    if (findGraphQLErrors.length > 0) {
      return {
        error: findGraphQLErrors[0]?.message ?? "GraphQL request failed",
      };
    }
    const existingCustomerId = findJson.data?.customers?.nodes?.[0]?.id;

    let mutationResponse: Response;
    if (existingCustomerId) {
      mutationResponse = await admin!.graphql(
        `#graphql
          mutation CustomerUpdate($input: CustomerInput!) {
            customerUpdate(input: $input) {
              userErrors { message }
            }
          }
        `,
        { variables: { input: { id: existingCustomerId, ...customerInput } } },
      );
    } else {
      mutationResponse = await admin!.graphql(
        `#graphql
          mutation CustomerCreate($input: CustomerInput!) {
            customerCreate(input: $input) {
              userErrors { message }
            }
          }
        `,
        { variables: { input: customerInput } },
      );
    }

    const mutationJson = (await mutationResponse.json()) as any;
    const mutationGraphQLErrors = mutationJson.errors ?? [];
    if (mutationGraphQLErrors.length > 0) {
      return {
        error: mutationGraphQLErrors[0]?.message ?? "GraphQL request failed",
      };
    }
    const userErrors = existingCustomerId
      ? mutationJson.data?.customerUpdate?.userErrors ?? []
      : mutationJson.data?.customerCreate?.userErrors ?? [];

    if (userErrors.length > 0) return { errors: userErrors };

    await db.wholesaleInquiry.update({
      where: { id: inquiry.id },
      data: { status: "APPROVED" },
    });

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown server error";
    return { error: `Something went wrong: ${errorMessage}` };
  }
};


export default function Index() {
  const fetcher = useFetcher<typeof action>();
  const { inquiries } = useLoaderData<typeof loader>();

  const rowMarkup = inquiries.map(
    ({ id, firstName, lastName, email, companyName, status }) => {
      const isApproving =
        fetcher.state !== "idle" && fetcher.formData?.get("id") === String(id);

      return (
        <s-table-row id={id.toString()} key={id}>
          <s-table-cell>{companyName}</s-table-cell>
          <s-table-cell>{firstName} {lastName}</s-table-cell>
          <s-table-cell>{email}</s-table-cell>
          <s-table-cell>
            <s-badge tone={status === "PENDING" ? "caution" : "success"}>
              {status}
            </s-badge>
          </s-table-cell>
          <s-table-cell>
            {status === "PENDING" ? (
              <s-button
                type="button"
                variant="secondary"
                loading={isApproving}
                onClick={() =>
                  fetcher.submit(
                    {
                      id: String(id)
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
            <s-table-header>Name</s-table-header>
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
