"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// @ts-nocheck
const express = require("express");
const app = express();
// Store previously processed message IDs
const previousMessages = new Set();
let chromium = {};
let puppeteer;
if (process.env.AWS_LAMBDA_FUNCTION_VERSION) {
    chromium = require("@sparticuz/chromium");
    puppeteer = require("puppeteer-core");
}
else {
    puppeteer = require("puppeteer");
}
app.get("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let options = {};
    if (process.env.AWS_LAMBDA_FUNCTION_VERSION) {
        options = {
            // args: [...chromium.args, "--hide-scrollbars", "--disable-web-security"],
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: yield chromium.executablePath(),
            headless: true,
            ignoreHTTPSErrors: true,
        };
    }
    else {
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
        const errorResponse = { error: "videoId is required" };
        return res.status(400).send({ message: JSON.stringify(errorResponse) });
    }
    const liveChatUrl = `https://www.youtube.com/live_chat?v=${videoId}&is_popout=1`;
    try {
        const browser = yield puppeteer.launch(options);
        const page = yield browser.newPage();
        // Stealth Measures
        yield page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, "webdriver", { get: () => false });
        });
        yield page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36");
        yield page.setViewport({ width: 1280, height: 800 });
        // Navigate to live chat
        yield page.goto(liveChatUrl, { waitUntil: "networkidle2" });
        yield page.waitForSelector("#contents yt-live-chat-text-message-renderer", {
            timeout: 60000,
        });
        // Fetch messages once
        const messages = yield page.evaluate(() => {
            const chatElements = Array.from(document.querySelectorAll("#contents yt-live-chat-text-message-renderer"));
            return chatElements.map((el) => {
                var _a, _b, _c;
                return ({
                    author: ((_b = (_a = el.querySelector("#author-name")) === null || _a === void 0 ? void 0 : _a.textContent) === null || _b === void 0 ? void 0 : _b.trim()) || "Unknown",
                    message: ((_c = el.querySelector("#message")) === null || _c === void 0 ? void 0 : _c.innerHTML) || "", // Include emojis as HTML
                    messageId: el.getAttribute("id") || "", // Extract the message ID
                });
            });
        });
        // Deduplicate messages by messageId
        const filteredMessages = messages.filter((msg) => msg.messageId && !previousMessages.has(msg.messageId));
        // Add new message IDs to the set
        filteredMessages.forEach((msg) => previousMessages.add(msg.messageId));
        yield browser.close();
        // Return the filtered messages
        return res.status(200).json(filteredMessages);
    }
    catch (err) {
        console.error(err);
        const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
        res.status(500).send({ message: JSON.stringify(errorResponse) });
    }
}));
app.listen(process.env.PORT || 3001, () => {
    console.log("Server started");
});
module.exports = app;
