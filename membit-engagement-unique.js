// membit-engagement-unique.js
import puppeteer from "puppeteer";
import fs from "fs/promises";

// Load akun
const accounts = JSON.parse(await fs.readFile("accounts.json", "utf-8"));

async function runBot(account) {
  const cookieFile = `cookies_${account.username}.json`;
  let seenPosts = [];

  // load daftar postingan unik
  try {
    seenPosts = JSON.parse(await fs.readFile("seen_posts.json", "utf-8"));
  } catch {
    seenPosts = [];
  }

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
  });
  const page = await browser.newPage();

  // coba load cookie
  try {
    const cookies = JSON.parse(await fs.readFile(cookieFile, "utf-8"));
    await page.setCookie(...cookies);
    console.log(`[+] Load cookie untuk ${account.username}`);
    await page.goto("https://twitter.com/home", { waitUntil: "networkidle2" });
  } catch {
    console.log(`[!] Belum ada cookie untuk ${account.username}, login manual...`);
    await page.goto("https://twitter.com/login", { waitUntil: "networkidle2" });

    await page.type('input[name="text"]', account.username, { delay: 50 });
    await page.keyboard.press("Enter");
    await page.waitForTimeout(2000);

    await page.type('input[name="password"]', account.password, { delay: 50 });
    await page.keyboard.press("Enter");
    await page.waitForNavigation();

    const cookies = await page.cookies();
    await fs.writeFile(cookieFile, JSON.stringify(cookies, null, 2));
    console.log(`[+] Cookie tersimpan: ${cookieFile}`);
  }

  console.log(`[+] Mulai auto-scroll feed...`);

  let start = Date.now();
  while (Date.now() - start < 5 * 60 * 1000) { // 5 menit
    // Scroll ke bawah
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await page.waitForTimeout(2000 + Math.random() * 3000);

    // Ambil postingan
    const posts = await page.$$("article");
    for (let post of posts) {
      try {
        // ambil tweet URL
        const url = await post.$eval('a[role="link"][href*="/status/"]', el => el.href);
        const tweetId = url.split("/status/")[1];

        // skip kalau sudah pernah
        if (seenPosts.includes(tweetId)) continue;

        // ambil likes & retweets
        const likes = await post.$eval('div[data-testid="like"]', el => el.innerText || "0").catch(() => "0");
        const retweets = await post.$eval('div[data-testid="retweet"]', el => el.innerText || "0").catch(() => "0");

        const likesNum = parseInt(likes.replace(/\D/g, "")) || 0;
        const retweetsNum = parseInt(retweets.replace(/\D/g, "")) || 0;

        // filter engagement
        if (likesNum > 10 || retweetsNum > 5) {
          console.log(`🔥 High Engagement Post: ${url} | Likes: ${likesNum} | RT: ${retweetsNum}`);
          seenPosts.push(tweetId);
        }
      } catch {
        // skip kalau error parsing
      }
    }

    // simpan daftar post unik
    await fs.writeFile("seen_posts.json", JSON.stringify(seenPosts, null, 2));
  }

  console.log(`[+] Selesai scroll untuk ${account.username}`);
  await browser.close();
}

// Jalankan untuk semua akun
for (const acc of accounts) {
  await runBot(acc);
}
