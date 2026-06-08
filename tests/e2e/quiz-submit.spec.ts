import { expect, test } from "@playwright/test";

const requiredEnv = {
  email: process.env.E2E_EMAIL,
  password: process.env.E2E_PASSWORD,
  questionSetId: process.env.E2E_QUESTION_SET_ID,
};

test.describe("quiz submission", () => {
  test("answers every question, submits, and does not expose raw fetch failures", async ({ page }) => {
    if (!requiredEnv.email || !requiredEnv.password || !requiredEnv.questionSetId) {
      throw new Error(
        "Set E2E_EMAIL, E2E_PASSWORD, and E2E_QUESTION_SET_ID for a confirmed test user before running this spec.",
      );
    }

    const consoleErrors: string[] = [];
    const requestFailures: string[] = [];
    const submitResponses: Array<{ url: string; status: number }> = [];

    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("requestfailed", (request) => {
      requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText}`);
    });
    page.on("response", (response) => {
      if (response.url().includes("/quiz-attempts/") && response.url().endsWith("/submit")) {
        submitResponses.push({ url: response.url(), status: response.status() });
      }
    });

    await page.goto("/login");
    await page.getByLabel("Email").fill(requiredEnv.email);
    await page.getByLabel("Password").fill(requiredEnv.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto(`/quiz-sets/${requiredEnv.questionSetId}`);
    await page.getByRole("button", { name: "Start quiz" }).click();
    await expect(page).toHaveURL(/\/quiz\/.+\?setId=/);

    const totalText = await page.locator("text=/Question 1 of \\d+/").textContent();
    const total = Number(totalText?.match(/of (\d+)/)?.[1]);
    expect(total, "quiz total question count").toBeGreaterThan(0);

    for (let questionIndex = 1; questionIndex <= total; questionIndex += 1) {
      const firstOption = page.getByRole("radio").first();
      await firstOption.check();

      if (questionIndex < total) {
        await page.getByRole("button", { name: "Next" }).click();
        await expect(page.getByText(`Question ${questionIndex + 1} of ${total}`)).toBeVisible();
      }
    }

    await expect(page.getByText(`${total} answered`)).toBeVisible();
    await page.getByRole("button", { name: "Submit quiz" }).click();

    await expect(page).toHaveURL(/\/results\/.+/);
    await expect(page.getByText("Failed to fetch")).toHaveCount(0);
    expect(submitResponses, "submit endpoint responses").toHaveLength(1);
    expect(submitResponses[0].status, "submit endpoint status").toBeLessThan(400);
    expect(
      requestFailures.filter((failure) => failure.includes("/quiz-attempts/")),
      "quiz request failures",
    ).toEqual([]);
    expect(consoleErrors, "browser console errors").toEqual([]);
  });
});
