// AIStatusHub — Professional Status Monitor Bot v2.0
// Monitors AI services and auto-tweets outages, recoveries & summaries
// Built to run reliably 24/7 on Render free tier

const { TwitterApi } = require('twitter-api-v2');
const https = require('https');
const http = require('http');

// ── Twitter Client ──────────────────────────────────────────────────
const twitterClient = new TwitterApi({
  appKey:       process.env.TWITTER_API_KEY,
  appSecret:    process.env.TWITTER_API_SECRET,
  accessToken:  process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});
const rwClient = twitterClient.readWrite;

// ── Config ──────────────────────────────────────────────────────────
const CHECK_EVERY    = 5  * 60 * 1000;  // check every 5 min
const SUMMARY_EVERY  = 6  * 60 * 60 * 1000; // summary every 6 hrs
const PING_EVERY     = 10 * 60 * 1000;  // self-ping every 10 min (keeps Render awake)
const SITE_URL       = 'https://aistatushub.com';
const PORT           = process.env.PORT || 3000;

// ── Services with verified working status page APIs ─────────────────
// Only including services with confirmed public statuspage.io APIs
const STATUS_PAGES = [
  // ── General AI ──
  { id:'chatgpt',     name:'ChatGPT',         url:'https://status.openai.com/api/v2/summary.json',            hashtags:'#ChatGPT #OpenAI',           pageUrl:`${SITE_URL}/chatgpt-status.html` },
  { id:'claude',      name:'Claude',          url:'https://status.anthropic.com/api/v2/summary.json',         hashtags:'#Claude #Anthropic',          pageUrl:`${SITE_URL}/claude-status.html` },
  { id:'grok',        name:'Grok',            url:'https://status.x.ai/api/v2/summary.json',                  hashtags:'#Grok #xAI',                  pageUrl:`${SITE_URL}/grok-status.html` },
  { id:'perplexity',  name:'Perplexity AI',   url:'https://status.perplexity.ai/api/v2/summary.json',         hashtags:'#Perplexity #AI',             pageUrl:`${SITE_URL}/perplexity-status.html` },
  { id:'mistral',     name:'Mistral AI',      url:'https://status.mistral.ai/api/v2/summary.json',            hashtags:'#MistralAI #AI',              pageUrl:`${SITE_URL}/mistral-status.html` },
  { id:'cohere',      name:'Cohere',          url:'https://status.cohere.com/api/v2/summary.json',            hashtags:'#Cohere #AI',                 pageUrl:`${SITE_URL}/cohere-status.html` },
  { id:'huggingface', name:'Hugging Face',    url:'https://status.huggingface.co/api/v2/summary.json',        hashtags:'#HuggingFace #AI',            pageUrl:`${SITE_URL}/huggingface-status.html` },
  { id:'together',    name:'Together AI',     url:'https://status.together.ai/api/v2/summary.json',           hashtags:'#TogetherAI #AI',             pageUrl:`${SITE_URL}/together-status.html` },
  { id:'groq',        name:'Groq',            url:'https://status.groq.com/api/v2/summary.json',              hashtags:'#Groq #AI',                   pageUrl:`${SITE_URL}/groq-status.html` },

  // ── Coding & Dev ──
  { id:'copilot',     name:'GitHub Copilot',  url:'https://www.githubstatus.com/api/v2/summary.json',         hashtags:'#GitHubCopilot #GitHub',      pageUrl:`${SITE_URL}/copilot-status.html` },
  { id:'claudecode',  name:'Claude Code',     url:'https://status.anthropic.com/api/v2/summary.json',         hashtags:'#ClaudeCode #Anthropic',      pageUrl:`${SITE_URL}/claudecode-status.html` },
  { id:'replit',      name:'Replit AI',       url:'https://status.replit.com/api/v2/summary.json',            hashtags:'#Replit #AI',                 pageUrl:`${SITE_URL}/replit-status.html` },
  { id:'vercel',      name:'Vercel',          url:'https://www.vercel-status.com/api/v2/summary.json',        hashtags:'#Vercel #DevTools',           pageUrl:`${SITE_URL}/vercel-status.html` },

  // ── Image & Video ──
  { id:'dalle',       name:'DALL·E 3',        url:'https://status.openai.com/api/v2/summary.json',            hashtags:'#DALLE3 #OpenAI',             pageUrl:`${SITE_URL}/dalle-status.html` },
  { id:'sora',        name:'Sora',            url:'https://status.openai.com/api/v2/summary.json',            hashtags:'#Sora #OpenAI',               pageUrl:`${SITE_URL}/sora-status.html` },
  { id:'runway',      name:'Runway',          url:'https://status.runway.team/api/v2/summary.json',           hashtags:'#Runway #AIVideo',            pageUrl:`${SITE_URL}/runway-status.html` },
  { id:'elevenlabs',  name:'ElevenLabs',      url:'https://status.elevenlabs.io/api/v2/summary.json',         hashtags:'#ElevenLabs #AIVoice',        pageUrl:`${SITE_URL}/elevenlabs-status.html` },
  { id:'synthesia',   name:'Synthesia',       url:'https://status.synthesia.io/api/v2/summary.json',          hashtags:'#Synthesia #AIVideo',         pageUrl:`${SITE_URL}/synthesia-status.html` },
  { id:'ideogram',    name:'Ideogram',        url:'https://status.ideogram.ai/api/v2/summary.json',           hashtags:'#Ideogram #AIArt',            pageUrl:`${SITE_URL}/ideogram-status.html` },

  // ── Business & Productivity ──
  { id:'grammarly',   name:'Grammarly',       url:'https://status.grammarly.com/api/v2/summary.json',         hashtags:'#Grammarly #AI',              pageUrl:`${SITE_URL}/grammarly-status.html` },
  { id:'notionai',    name:'Notion AI',       url:'https://status.notion.so/api/v2/summary.json',             hashtags:'#NotionAI #Notion',           pageUrl:`${SITE_URL}/notionai-status.html` },
  { id:'writer',      name:'Writer',          url:'https://status.writer.com/api/v2/summary.json',            hashtags:'#Writer #AI',                 pageUrl:`${SITE_URL}/writer-status.html` },
];

// ── State tracking ──────────────────────────────────────────────────
const seenIncidents       = new Set();
const lastComponentStatus = {};
const currentOutages      = new Map();
let   totalTweets         = 0;
let   lastCheckTime       = null;
let   botStartTime        = new Date();

// ── HTTP fetch with redirect support ───────────────────────────────
function fetchJSON(url, hops = 0) {
  return new Promise((resolve, reject) => {
    if (hops > 5) return reject(new Error('Too many redirects'));
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, {
      headers: {
        'User-Agent': 'AIStatusHub-Monitor/2.0 (https://aistatushub.com)',
        'Accept':     'application/json',
      }
    }, (res) => {
      // Follow redirects
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
        const next = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        res.resume();
        return resolve(fetchJSON(next, hops + 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try   { resolve(JSON.parse(data)); }
        catch { reject(new Error('Invalid JSON response')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(12000, () => { req.destroy(); reject(new Error('Request timeout')); });
  });
}

// ── Safe tweet helper ───────────────────────────────────────────────
async function tweet(text) {
  if (text.length > 280) text = text.slice(0, 277) + '...';
  try {
    await rwClient.v2.tweet(text);
    totalTweets++;
    console.log(`[${new Date().toISOString()}] ✅ TWEETED (${totalTweets} total): ${text.slice(0, 60)}...`);
    return true;
  } catch (err) {
    const detail = err?.data?.detail || err?.data?.title || err.message;
    console.error(`[${new Date().toISOString()}] ❌ TWEET FAILED: ${detail}`);
    return false;
  }
}

// ── Check one service ───────────────────────────────────────────────
async function checkService(svc) {
  try {
    const data = await fetchJSON(svc.url);

    // 1. Check active incidents
    for (const inc of (data.incidents || [])) {
      if (seenIncidents.has(inc.id)) continue;
      seenIncidents.add(inc.id);

      const update = inc.incident_updates?.[0]?.body || inc.name || 'Service disruption';
      const impact = inc.impact || 'minor';
      const status = inc.status || 'investigating';
      const emoji  = { critical:'🚨', major:'⚠️', minor:'🟡' }[impact] || '📢';

      await tweet(
        `${emoji} ${svc.name} — ${status.toUpperCase()}\n\n` +
        `${update.slice(0, 140)}${update.length > 140 ? '...' : ''}\n\n` +
        `Live status → ${svc.pageUrl}\n` +
        `${svc.hashtags} #AIStatus #AIOutage`
      );
      await sleep(3000);
    }

    // 2. Check component status changes
    for (const comp of (data.components || [])) {
      // Skip group components (they're just labels)
      if (comp.group) continue;

      const key  = `${svc.id}::${comp.id}`;
      const prev = lastComponentStatus[key];
      lastComponentStatus[key] = comp.status;

      // First time seeing this component — just record it
      if (prev === undefined) {
        if (comp.status !== 'operational') {
          currentOutages.set(key, { name: svc.name, component: comp.name, status: comp.status });
        }
        continue;
      }

      // No change
      if (prev === comp.status) continue;

      // Status changed!
      if (comp.status === 'operational') {
        currentOutages.delete(key);
        await tweet(
          `✅ ${svc.name} — "${comp.name}" restored to OPERATIONAL\n\n` +
          `All systems back to normal → ${svc.pageUrl}\n` +
          `${svc.hashtags} #AIStatus`
        );
      } else {
        currentOutages.set(key, { name: svc.name, component: comp.name, status: comp.status });
        const emoji = { major_outage:'🔴', partial_outage:'🟠', degraded_performance:'🟡' }[comp.status] || '🟡';
        await tweet(
          `${emoji} ${svc.name} — "${comp.name}" is ${comp.status.replace(/_/g,' ').toUpperCase()}\n\n` +
          `Live status → ${svc.pageUrl}\n` +
          `${svc.hashtags} #AIStatus #AIOutage`
        );
      }
      await sleep(3000);
    }

  } catch (err) {
    // Only log — don't crash
    console.log(`[${new Date().toISOString()}] ⚠️  ${svc.name}: ${err.message}`);
  }
}

// ── Check all services ──────────────────────────────────────────────
async function checkAll() {
  lastCheckTime = new Date();
  console.log(`[${lastCheckTime.toISOString()}] 🔍 Checking ${STATUS_PAGES.length} services...`);
  for (const svc of STATUS_PAGES) {
    await checkService(svc);
    await sleep(1000);
  }
  console.log(`[${new Date().toISOString()}] ✅ Check complete. Active outages: ${currentOutages.size}`);
}

// ── 6-hour summary tweet ────────────────────────────────────────────
async function tweetSummary() {
  const now       = new Date();
  const timeStr   = now.toUTCString().replace(' GMT','') + ' UTC';
  const outages   = [...new Set([...currentOutages.values()].map(o => o.name))];
  const downCount = outages.length;
  const okCount   = STATUS_PAGES.length - downCount;

  let text;
  if (downCount === 0) {
    text =
      `📊 AI Status Report — ${timeStr}\n\n` +
      `✅ All ${STATUS_PAGES.length} monitored AI services are OPERATIONAL\n\n` +
      `Tracking: ChatGPT, Claude, Gemini, ElevenLabs, Runway + ${STATUS_PAGES.length - 5} more\n\n` +
      `Full dashboard → ${SITE_URL}\n` +
      `#AIStatus #AITools #StatusUpdate`;
  } else {
    const list = outages.slice(0, 4).join(', ');
    const more = outages.length > 4 ? ` +${outages.length - 4} more` : '';
    text =
      `📊 AI Status Report — ${timeStr}\n\n` +
      `🔴 ${downCount} service(s) with issues:\n${list}${more}\n\n` +
      `✅ ${okCount} services operational\n\n` +
      `Full dashboard → ${SITE_URL}\n` +
      `#AIStatus #AIOutage #AITools`;
  }

  await tweet(text);
}

// ── Helper ──────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Keep-alive HTTP server (prevents Render free tier sleep) ────────
function startKeepAliveServer() {
  const server = require('http').createServer((req, res) => {
    const uptime = Math.floor((Date.now() - botStartTime) / 1000 / 60);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status:       'running',
      uptime_mins:  uptime,
      total_tweets: totalTweets,
      tracked:      STATUS_PAGES.length,
      active_issues:currentOutages.size,
      last_check:   lastCheckTime?.toISOString() || 'pending',
    }));
  });
  server.listen(PORT, () => {
    console.log(`[${new Date().toISOString()}] 🌐 Health server running on port ${PORT}`);
  });
}

// ── Self-ping to prevent Render sleep ──────────────────────────────
function startSelfPing() {
  const serviceUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  setInterval(() => {
    const lib = serviceUrl.startsWith('https') ? https : http;
    lib.get(serviceUrl, (res) => {
      console.log(`[${new Date().toISOString()}] 🏓 Self-ping OK (${res.statusCode})`);
      res.resume();
    }).on('error', (e) => {
      console.log(`[${new Date().toISOString()}] 🏓 Self-ping failed: ${e.message}`);
    });
  }, PING_EVERY);
}

// ── Boot sequence ───────────────────────────────────────────────────
async function boot() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  AIStatusHub Bot v2.0 — Starting up`);
  console.log(`  Tracking ${STATUS_PAGES.length} services`);
  console.log(`${'='.repeat(60)}\n`);

  // Start HTTP server immediately so Render marks deploy as successful
  startKeepAliveServer();

  // Seed state silently on boot (no tweets for existing issues)
  console.log(`[${new Date().toISOString()}] 🌱 Seeding initial state...`);
  for (const svc of STATUS_PAGES) {
    try {
      const data = await fetchJSON(svc.url);
      (data.incidents  || []).forEach(i => seenIncidents.add(i.id));
      (data.components || []).forEach(c => {
        if (!c.group) {
          const key = `${svc.id}::${c.id}`;
          lastComponentStatus[key] = c.status;
          if (c.status !== 'operational') {
            currentOutages.set(key, { name: svc.name, component: c.name, status: c.status });
          }
        }
      });
    } catch { /* ignore */ }
    await sleep(400);
  }
  console.log(`[${new Date().toISOString()}] ✅ Seeded. Incidents known: ${seenIncidents.size}, Active issues: ${currentOutages.size}`);

  // Send startup summary tweet
  await tweetSummary();

  // Start self-ping to keep Render awake
  startSelfPing();

  // Start monitoring loops
  setInterval(checkAll, CHECK_EVERY);
  setInterval(tweetSummary, SUMMARY_EVERY);

  // Run first check after 30s
  setTimeout(checkAll, 30 * 1000);

  console.log(`[${new Date().toISOString()}] 🤖 Bot fully running. Checks every 5 min, summaries every 6 hrs.`);
}

// ── Crash protection ────────────────────────────────────────────────
process.on('uncaughtException',  e => console.error(`[UNCAUGHT]`, e.message));
process.on('unhandledRejection', e => console.error(`[UNHANDLED]`, e));

boot();
