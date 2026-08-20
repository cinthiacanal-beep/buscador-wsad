const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

async function iniciarNavegador() {
    console.log("Iniciando Chromium en la nube...");
    const browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
    });

    const pages = await browser.pages();
    page = pages.length > 0 ? pages[0] : await browser.newPage();
}
