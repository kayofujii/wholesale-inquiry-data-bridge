import { test, expect } from "@playwright/test";
import db from "../app/db.server";

test("approve changes PENDING to APPROVED", async ({ page }, testInfo) => {
  const uniqueEmail = `test-${testInfo.project.name}-${testInfo.workerIndex}-${Date.now()}@example.com`;

  const inquiry = await db.wholesaleInquiry.create({
    data: {
      firstName: "Test",
      lastName: "User",
      email: uniqueEmail,
      phoneNumber: "1234567890",
      companyName: "Test Co",
      status: "PENDING",
    },
  });

  await page.goto("/app");
  await expect(page.getByText(uniqueEmail)).toBeVisible();

  const row = page.locator(`s-table-row[id="${inquiry.id}"]`);
  await expect(row.locator("s-badge", { hasText: "PENDING" })).toBeVisible();
  await row.getByRole("button", { name: "Approve" }).click();
  await expect(row.locator("s-badge", { hasText: "APPROVED" })).toBeVisible();
  await expect(row.getByRole("button", { name: "Approve" })).toHaveCount(0);
  await expect(row.getByText("Approved", { exact: true })).toBeVisible();
});
