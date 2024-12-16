// @ts-nocheck
const express = require("express");
const app = express();

// Define the response type for live chat messages
interface ChatMessage {
  author: string;
  message: string;
  messageId: string;
}

// Store previously processed message IDs
const previousMessages = new Set<string>();

let chromium = {};
let puppeteer;

if (process.env.AWS_LAMBDA_FUNCTION_VERSION) {
  chromium = require("@sparticuz/chromium");
  puppeteer = require("puppeteer-core");
} else {
  puppeteer = require("puppeteer");
}

app.get("/", async (req, res) => {
  let options = {};

  if (process.env.AWS_LAMBDA_FUNCTION_VERSION) {
    options = {
      // args: [...chromium.args, "--hide-scrollbars", "--disable-web-security"],
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: true,
      ignoreHTTPSErrors: true,
    };
  } else {
    options = {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
      ]
    };
  }

  const { videoId } = req.query;

  // Validate the videoId query parameter
  if (!videoId) {
    const errorResponse: ErrorResponse = { error: "videoId is required" };
    return res.status(400).send({ message: JSON.stringify(errorResponse) });
  }

  const liveChatUrl = `https://www.youtube.com/live_chat?v=${videoId}&is_popout=1`;

  try {
    const browser = await puppeteer.launch(options);

    const page = await browser.newPage();

    // Stealth Measures
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
    });

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
    );
    await page.setViewport({ width: 1280, height: 800 });

    // Navigate to live chat
    await page.goto(liveChatUrl, { waitUntil: "networkidle2" });
    await page.waitForSelector("#contents yt-live-chat-text-message-renderer", {
      timeout: 60000,
    });

    // Fetch messages once
    const messages = await page.evaluate((): ChatMessage[] => {
      const chatElements = Array.from(
        document.querySelectorAll(
          "#contents yt-live-chat-text-message-renderer"
        )
      );
      // Take the last 20 elements
      const last20Elements = chatElements.slice(-20);

      // Map the last 20 elements to extract the desired data
      return last20Elements.map((el) => ({
        author: el.querySelector("#author-name")?.textContent?.trim() || "Unknown",
        message: el.querySelector("#message")?.innerHTML || "", // Include emojis as HTML
        messageId: el.getAttribute("id") || "", // Extract the message ID
      }));
    });

    // Deduplicate messages by messageId
    const filteredMessages = messages.filter(
      (msg) => msg.messageId && !previousMessages.has(msg.messageId)
    );

    // Add new message IDs to the set
    filteredMessages.forEach((msg) => previousMessages.add(msg.messageId));

    await browser.close();

    // Return the filtered messages
    return res.status(200).json(filteredMessages);
  } catch (err: unknown) {
    console.error(err);
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error occurred";
    res.status(500).send({ message: JSON.stringify(errorResponse) });
  }
});

app.listen(process.env.PORT || 3001, () => {
  console.log("Server started");
});

module.exports = app;
