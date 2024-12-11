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
let chrome = {};
let puppeteer;
if (process.env.AWS_LAMBDA_FUNCTION_VERSION) {
    chrome = require("chrome-aws-lambda");
    puppeteer = require("puppeteer-core");
}
else {
    puppeteer = require("puppeteer");
}
app.get("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let options = {};
    if (process.env.AWS_LAMBDA_FUNCTION_VERSION) {
        options = {
            args: [...chrome.args, "--hide-scrollbars", "--disable-web-security"],
            defaultViewport: chrome.defaultViewport,
            executablePath: yield chrome.executablePath,
            headless: true,
            ignoreHTTPSErrors: true,
        };
    }
    try {
        let browser = yield puppeteer.launch(options);
        let page = yield browser.newPage();
        yield page.goto("https://www.google.com");
        res.send(yield page.title());
    }
    catch (err) {
        console.error(err);
        return null;
    }
}));
app.listen(process.env.PORT || 3001, () => {
    console.log("Server started");
});
module.exports = app;
