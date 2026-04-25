// AIStatusHub — Professional Status Monitor Bot v7.0
// Status checks: ONLY official status pages or direct HTTP health checks
// X API: ONLY used for the final tweet write — zero status reads from X
// No summary tweets — only outages, recoveries & incident updates

const { TwitterApi } = require('twitter-api-v2');
const https = require('https');
const http = require('http');

// ── Twitter Client (WRITE ONLY — used only to post tweets) ──────────
const twitterClient = new TwitterApi({
  appKey:       process.env.TWITTER_API_KEY,
  appSecret:    process.env.TWITTER_API_SECRET,
  accessToken:  process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});
const rwClient = twitterClient.readWrite;

// ── Config ──────────────────────────────────────────────────────────
const CHECK_EVERY = 5  * 60 * 1000;   // status check every 5 min
const PING_EVERY  = 14 * 60 * 1000;   // self-ping every 14 min
const SITE_URL    = 'https://aistatushub.com';
const PORT        = process.env.PORT || 3000;

// ── SERVICE LIST ─────────────────────────────────────────────────────
// type:'statuspage' = official statuspage.io JSON API (best — full incidents)
// type:'healthcheck' = direct HTTP ping to main site (no public status API)
//
// statusUrlId groups services that share the same status page URL
// so we fetch ONCE and tweet ONCE — no duplicates, no extra API calls
// ─────────────────────────────────────────────────────────────────────
const STATUS_PAGES = [

  // ── General AI ───────────────────────────────────────────────────
  {
    id:'chatgpt', name:'ChatGPT', type:'statuspage', statusUrlId:'openai',
    url:'https://status.openai.com/api/v2/summary.json',
    healthUrl:'https://chatgpt.com',
    hashtags:'#ChatGPT #OpenAI', pageUrl:`${SITE_URL}/chatgpt-status.html`
  },
  {
    id:'claude', name:'Claude', type:'statuspage', statusUrlId:'anthropic',
    url:'https://status.anthropic.com/api/v2/summary.json',
    healthUrl:'https://claude.ai',
    hashtags:'#Claude #Anthropic', pageUrl:`${SITE_URL}/claude-status.html`
  },
  {
    id:'gemini', name:'Google Gemini', type:'healthcheck', statusUrlId:'gemini',
    url:null, healthUrl:'https://gemini.google.com',
    hashtags:'#Gemini #Google', pageUrl:`${SITE_URL}/gemini-status.html`
  },
  {
    id:'grok', name:'Grok', type:'statuspage', statusUrlId:'grok',
    url:'https://status.x.ai/api/v2/summary.json',
    healthUrl:'https://grok.com',
    hashtags:'#Grok #xAI', pageUrl:`${SITE_URL}/grok-status.html`
  },
  {
    id:'perplexity', name:'Perplexity AI', type:'statuspage', statusUrlId:'perplexity',
    url:'https://status.perplexity.ai/api/v2/summary.json',
    healthUrl:'https://perplexity.ai',
    hashtags:'#Perplexity #AI', pageUrl:`${SITE_URL}/perplexity-status.html`
  },
  {
    id:'mscopilot', name:'Microsoft Copilot', type:'healthcheck', statusUrlId:'mscopilot',
    url:null, healthUrl:'https://copilot.microsoft.com',
    hashtags:'#MicrosoftCopilot #Microsoft', pageUrl:`${SITE_URL}/mscopilot-status.html`
  },
  {
    id:'mistral', name:'Mistral AI', type:'statuspage', statusUrlId:'mistral',
    url:'https://status.mistral.ai/api/v2/summary.json',
    healthUrl:'https://mistral.ai',
    hashtags:'#MistralAI #AI', pageUrl:`${SITE_URL}/mistral-status.html`
  },
  {
    id:'llama', name:'Meta Llama', type:'healthcheck', statusUrlId:'llama',
    url:null, healthUrl:'https://llama.meta.com',
    hashtags:'#MetaLlama #Meta', pageUrl:`${SITE_URL}/llama-status.html`
  },
  {
    id:'cohere', name:'Cohere', type:'statuspage', statusUrlId:'cohere',
    url:'https://status.cohere.com/api/v2/summary.json',
    healthUrl:'https://cohere.com',
    hashtags:'#Cohere #AI', pageUrl:`${SITE_URL}/cohere-status.html`
  },
  {
    id:'huggingface', name:'Hugging Face', type:'statuspage', statusUrlId:'huggingface',
    url:'https://status.huggingface.co/api/v2/summary.json',
    healthUrl:'https://huggingface.co',
    hashtags:'#HuggingFace #AI', pageUrl:`${SITE_URL}/huggingface-status.html`
  },
  {
    id:'deepl', name:'DeepL', type:'healthcheck', statusUrlId:'deepl',
    url:null, healthUrl:'https://deepl.com',
    hashtags:'#DeepL #Translation', pageUrl:`${SITE_URL}/deepl-status.html`
  },
  {
    id:'canva', name:'Canva AI', type:'healthcheck', statusUrlId:'canva',
    url:null, healthUrl:'https://canva.com',
    hashtags:'#Canva #AIDesign', pageUrl:`${SITE_URL}/canva-status.html`
  },
  {
    id:'you', name:'You.com', type:'healthcheck', statusUrlId:'you',
    url:null, healthUrl:'https://you.com',
    hashtags:'#YouCom #AI', pageUrl:`${SITE_URL}/you-status.html`
  },
  {
    id:'together', name:'Together AI', type:'statuspage', statusUrlId:'together',
    url:'https://status.together.ai/api/v2/summary.json',
    healthUrl:'https://together.ai',
    hashtags:'#TogetherAI #AI', pageUrl:`${SITE_URL}/together-status.html`
  },

  // ── Coding & Dev ─────────────────────────────────────────────────
  {
    id:'copilot', name:'GitHub Copilot', type:'statuspage', statusUrlId:'github',
    url:'https://www.githubstatus.com/api/v2/summary.json',
    healthUrl:'https://github.com',
    hashtags:'#GitHubCopilot #GitHub', pageUrl:`${SITE_URL}/copilot-status.html`
  },
  {
    // Cursor now has an official status page at status.cursor.com
    id:'cursor', name:'Cursor', type:'statuspage', statusUrlId:'cursor',
    url:'https://status.cursor.com/api/v2/summary.json',
    healthUrl:'https://cursor.com',
    hashtags:'#Cursor #AI', pageUrl:`${SITE_URL}/cursor-status.html`
  },
  {
    // Claude Code shares Anthropic status page — same statusUrlId, no duplicate tweets
    id:'claudecode', name:'Claude Code', type:'statuspage', statusUrlId:'anthropic',
    url:'https://status.anthropic.com/api/v2/summary.json',
    healthUrl:'https://claude.ai',
    hashtags:'#ClaudeCode #Anthropic', pageUrl:`${SITE_URL}/claudecode-status.html`
  },
  {
    id:'amazonq', name:'Amazon Q', type:'healthcheck', statusUrlId:'amazonq',
    url:null, healthUrl:'https://aws.amazon.com/q',
    hashtags:'#AmazonQ #AWS', pageUrl:`${SITE_URL}/amazonq-status.html`
  },
  {
    id:'replit', name:'Replit AI', type:'statuspage', statusUrlId:'replit',
    url:'https://status.replit.com/api/v2/summary.json',
    healthUrl:'https://replit.com',
    hashtags:'#Replit #AI', pageUrl:`${SITE_URL}/replit-status.html`
  },
  {
    id:'phind', name:'Phind', type:'healthcheck', statusUrlId:'phind',
    url:null, healthUrl:'https://phind.com',
    hashtags:'#Phind #AI', pageUrl:`${SITE_URL}/phind-status.html`
  },

  // ── Visuals, Audio & Video ────────────────────────────────────────
  {
    id:'midjourney', name:'Midjourney', type:'healthcheck', statusUrlId:'midjourney',
    url:null, healthUrl:'https://midjourney.com',
    hashtags:'#Midjourney #AIArt', pageUrl:`${SITE_URL}/midjourney-status.html`
  },
  {
    // DALL·E + Sora share OpenAI status — same statusUrlId, no duplicate tweets
    id:'dalle', name:'DALL·E 3', type:'statuspage', statusUrlId:'openai',
    url:'https://status.openai.com/api/v2/summary.json',
    healthUrl:'https://openai.com',
    hashtags:'#DALLE3 #OpenAI', pageUrl:`${SITE_URL}/dalle-status.html`
  },
  {
    id:'sora', name:'Sora', type:'statuspage', statusUrlId:'openai',
    url:'https://status.openai.com/api/v2/summary.json',
    healthUrl:'https://openai.com',
    hashtags:'#Sora #OpenAI', pageUrl:`${SITE_URL}/sora-status.html`
  },
  {
    id:'adobefirefly', name:'Adobe Firefly', type:'healthcheck', statusUrlId:'adobefirefly',
    url:null, healthUrl:'https://firefly.adobe.com',
    hashtags:'#AdobeFirefly #Adobe', pageUrl:`${SITE_URL}/adobefirefly-status.html`
  },
  {
    id:'stability', name:'Stability AI', type:'healthcheck', statusUrlId:'stability',
    url:null, healthUrl:'https://stability.ai',
    hashtags:'#StabilityAI #AIArt', pageUrl:`${SITE_URL}/stability-status.html`
  },
  {
    id:'runway', name:'Runway', type:'statuspage', statusUrlId:'runway',
    url:'https://status.runway.team/api/v2/summary.json',
    healthUrl:'https://runwayml.com',
    hashtags:'#Runway #AIVideo', pageUrl:`${SITE_URL}/runway-status.html`
  },
  {
    id:'googleveo', name:'Google Veo', type:'healthcheck', statusUrlId:'googleveo',
    url:null, healthUrl:'https://deepmind.google',
    hashtags:'#GoogleVeo #Google', pageUrl:`${SITE_URL}/googleveo-status.html`
  },
  {
    id:'synthesia', name:'Synthesia', type:'statuspage', statusUrlId:'synthesia',
    url:'https://status.synthesia.io/api/v2/summary.json',
    healthUrl:'https://synthesia.io',
    hashtags:'#Synthesia #AIVideo', pageUrl:`${SITE_URL}/synthesia-status.html`
  },
  {
    id:'elevenlabs', name:'ElevenLabs', type:'statuspage', statusUrlId:'elevenlabs',
    url:'https://status.elevenlabs.io/api/v2/summary.json',
    healthUrl:'https://elevenlabs.io',
    hashtags:'#ElevenLabs #AIVoice', pageUrl:`${SITE_URL}/elevenlabs-status.html`
  },
  {
    id:'flux', name:'Flux (BFL)', type:'healthcheck', statusUrlId:'flux',
    url:null, healthUrl:'https://blackforestlabs.ai',
    hashtags:'#Flux #AIArt', pageUrl:`${SITE_URL}/flux-status.html`
  },
  {
    id:'ideogram', name:'Ideogram', type:'statuspage', statusUrlId:'ideogram',
    url:'https://status.ideogram.ai/api/v2/summary.json',
    healthUrl:'https://ideogram.ai',
    hashtags:'#Ideogram #AIArt', pageUrl:`${SITE_URL}/ideogram-status.html`
  },
  {
    id:'suno', name:'Suno', type:'healthcheck', statusUrlId:'suno',
    url:null, healthUrl:'https://suno.com',
    hashtags:'#Suno #AIMusic', pageUrl:`${SITE_URL}/suno-status.html`
  },

  // ── Business, Content & Data ──────────────────────────────────────
  {
    id:'jasper', name:'Jasper AI', type:'healthcheck', statusUrlId:'jasper',
    url:null, healthUrl:'https://jasper.ai',
    hashtags:'#Jasper #AI', pageUrl:`${SITE_URL}/jasper-status.html`
  },
  {
    id:'grammarly', name:'Grammarly', type:'statuspage', statusUrlId:'grammarly',
    url:'https://status.grammarly.com/api/v2/summary.json',
    healthUrl:'https://grammarly.com',
    hashtags:'#Grammarly #AI', pageUrl:`${SITE_URL}/grammarly-status.html`
  },
  {
    id:'notionai', name:'Notion AI', type:'statuspage', statusUrlId:'notion',
    url:'https://status.notion.so/api/v2/summary.json',
    healthUrl:'https://notion.so',
    hashtags:'#NotionAI #Notion', pageUrl:`${SITE_URL}/notionai-status.html`
  },
  {
    id:'glean', name:'Glean', type:'healthcheck', statusUrlId:'glean',
    url:null, healthUrl:'https://glean.com',
    hashtags:'#Glean #AI', pageUrl:`${SITE_URL}/glean-status.html`
  },
  {
    id:'writer', name:'Writer', type:'statuspage', statusUrlId:'writer',
    url:'https://status.writer.com/api/v2/summary.json',
    healthUrl:'https://writer.com',
    hashtags:'#Writer #AI', pageUrl:`${SITE_URL}/writer-status.html`
  },
  {
    id:'anomalyai', name:'Anomaly AI', type:'healthcheck', statusUrlId:'anomalyai',
    url:null, healthUrl:'https://anomaly.ai',
    hashtags:'#AnomalyAI #DataAI', pageUrl:`${SITE_URL}/anomalyai-status.html`
  },
  {
    id:'ada', name:'Ada', type:'healthcheck', statusUrlId:'ada',
    url:null, healthUrl:'https://ada.cx',
    hashtags:'#Ada #AI', pageUrl:`${SITE_URL}/ada-status.html`
  },
];

// ── Build deduped status URL registry ────────────────────────────────
// Each unique statusUrlId is fetched ONCE regardless of how many services share it
const statusUrlRegistry = {};
for (const svc of STATUS_PAGES) {
  if (svc.type !== 'statuspage') continue;
  if (!statusUrlRegistry[svc.statusUrlId]) {
    statusUrlRegistry[svc.statusUrlId] = { url: svc.url, services: [] };
  }
  statusUrlRegistry[svc.statusUrlId].services.push(svc);
}

const statusPageCount  = Object.keys(statusUrlRegistry).length;
const healthCheckCount = STATUS_PAGES.filter(s => s.type === 'healthcheck').length;

// ── State ─────────────────────────────────────────────────────────────
const seenIncidents       = new Set();
const seenIncidentUpdates = new Set();
const lastComponentStatus = {};
const currentOutages      = new Map();
const healthStatus        = {};
let   totalTweets         = 0;
let   lastCheckTime       = null;
const botStartTime        = new Date();

// ── Helpers ───────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Generic HTTP fetch with redirect support — used ONLY for status pages
function fetchJSON(url, hops = 0) {
  return new Promise((resolve, reject) => {
    if (hops > 5) return reject(new Error('Too many redirects'));
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, {
      headers: {
        'User-Agent': 'AIStatusHub/7.0 (https://aistatushub.com)',
        'Accept':     'application/json',
      }
    }, res => {
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
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try   { resolve(JSON.parse(d)); }
        catch { reject(new Error('Invalid JSON — page returned HTML instead of JSON')); }
      });
    })
    .on('error', reject)
    .setTimeout(12000, function() { this.destroy(); reject(new Error('Timeout after 12s')); });
  });
}

// Direct HTTP health check — ONLY checks if site responds (no X API involved)
function checkHealth(url) {
  return new Promise(resolve => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, {
      headers: { 'User-Agent': 'AIStatusHub/7.0 (https://aistatushub.com)' }
    }, res => {
      res.resume();
      // Treat anything below 500 as "up" (redirects, 200, 404 are all "up")
      resolve(res.statusCode < 500);
    })
    .on('error', () => resolve(false))
    .setTimeout(10000, function() { this.destroy(); resolve(false); });
  });
}

// ── TWEET — the ONLY place X API is called ───────────────────────────
async function tweet(text) {
  if (text.length > 280) text = text.slice(0, 277) + '...';
  try {
    await rwClient.v2.tweet(text); // ← ONLY X API call in entire bot
    totalTweets++;
    console.log(`[${new Date().toISOString()}] ✅ TWEET #${totalTweets}: ${text.slice(0, 70)}...`);
    return true;
  } catch (err) {
    console.error(`[${new Date().toISOString()}] ❌ TWEET FAILED: ${err?.data?.detail || err.message}`);
    return false;
  }
}

// ── Check one statuspage.io group (fetched via HTTPS, NOT X API) ─────
async function checkStatuspageGroup(urlId, group) {
  // Fetch from official statuspage.io API — no X API involved
  const data = await fetchJSON(group.url);

  const groupName  = group.services.map(s => s.name).join(' / ');
  const pageUrl    = group.services[0].pageUrl;
  const hashtagSet = new Set(group.services.flatMap(s => s.hashtags.split(' ')));
  const hashtags   = [...hashtagSet].slice(0, 4).join(' ');

  // ── New incidents ──────────────────────────────────────────────
  for (const inc of (data.incidents || [])) {
    const impact = inc.impact || 'minor';
    const status = inc.status || 'investigating';
    const emoji  = { critical:'🚨', major:'⚠️', minor:'🟡' }[impact] || '📢';

    if (!seenIncidents.has(inc.id)) {
      seenIncidents.add(inc.id);
      const update = inc.incident_updates?.[0]?.body || inc.name || 'Service disruption reported';
      await tweet(
        `${emoji} ${groupName} — ${status.toUpperCase()}\n\n` +
        `${update.slice(0, 150)}${update.length > 150 ? '...' : ''}\n\n` +
        `Live status → ${pageUrl}\n${hashtags} #AIStatus #AIOutage`
      );
      await sleep(3000);
    }

    // ── New updates on existing incidents ──────────────────────
    for (const upd of (inc.incident_updates || [])) {
      if (seenIncidentUpdates.has(upd.id)) continue;
      seenIncidentUpdates.add(upd.id);
      if (!seenIncidents.has(inc.id)) continue; // skip if incident itself is new (already tweeted)
      const updStatus = upd.status || status;
      const updEmoji  = updStatus === 'resolved'   ? '✅' :
                        updStatus === 'monitoring' ? '👀' :
                        updStatus === 'identified' ? '🔎' : emoji;
      await tweet(
        `${updEmoji} ${groupName} UPDATE — ${updStatus.toUpperCase()}\n\n` +
        `${upd.body.slice(0, 150)}${upd.body.length > 150 ? '...' : ''}\n\n` +
        `Full incident → ${pageUrl}\n${hashtags} #AIStatus`
      );
      await sleep(3000);
    }
  }

  // ── Component status changes ───────────────────────────────────
  for (const comp of (data.components || [])) {
    if (comp.group) continue; // skip group headers
    const key  = `${urlId}::${comp.id}`;
    const prev = lastComponentStatus[key];
    lastComponentStatus[key] = comp.status;

    if (prev === undefined) {
      // First time seeing — seed state, no tweet
      if (comp.status !== 'operational')
        currentOutages.set(key, { name: groupName, component: comp.name, status: comp.status });
      continue;
    }
    if (prev === comp.status) continue; // no change

    if (comp.status === 'operational') {
      currentOutages.delete(key);
      await tweet(
        `✅ ${groupName} — "${comp.name}" RESTORED\n\n` +
        `Service is back to fully operational.\n` +
        `Full status → ${pageUrl}\n${hashtags} #AIStatus`
      );
    } else {
      currentOutages.set(key, { name: groupName, component: comp.name, status: comp.status });
      const e = { major_outage:'🔴', partial_outage:'🟠', degraded_performance:'🟡' }[comp.status] || '🟡';
      await tweet(
        `${e} ${groupName} — "${comp.name}" is ${comp.status.replace(/_/g,' ').toUpperCase()}\n\n` +
        `Live status → ${pageUrl}\n${hashtags} #AIStatus #AIOutage`
      );
    }
    await sleep(3000);
  }
}

// ── Check one health-check service (direct HTTP ping, NOT X API) ─────
async function checkHealthService(svc) {
  const isUp = await checkHealth(svc.healthUrl); // direct HTTP — no X API
  const prev = healthStatus[svc.id];
  healthStatus[svc.id] = isUp ? 'up' : 'down';

  if (prev === undefined) {
    // First check — seed state, no tweet
    if (!isUp) currentOutages.set(svc.id, { name: svc.name, component: svc.name, status: 'down' });
    return;
  }
  if (prev === 'up' && !isUp) {
    currentOutages.set(svc.id, { name: svc.name, component: svc.name, status: 'down' });
    await tweet( // ← only X API call
      `🔴 ${svc.name} appears to be DOWN\n\n` +
      `Service is not responding to requests.\n` +
      `Monitor live → ${svc.pageUrl}\n${svc.hashtags} #AIStatus #AIOutage`
    );
  } else if (prev === 'down' && isUp) {
    currentOutages.delete(svc.id);
    await tweet( // ← only X API call
      `✅ ${svc.name} is back ONLINE\n\n` +
      `Service has recovered and is responding normally.\n` +
      `Full status → ${svc.pageUrl}\n${svc.hashtags} #AIStatus`
    );
  }
}

// ── Check all 39 services ─────────────────────────────────────────────
async function checkAll() {
  lastCheckTime = new Date();
  console.log(`[${lastCheckTime.toISOString()}] 🔍 Checking ${STATUS_PAGES.length} services...`);
  console.log(`    → ${statusPageCount} official status APIs | ${healthCheckCount} HTTP health checks | 0 X API reads`);

  // Check official status pages (unique URLs only — deduped)
  for (const [urlId, group] of Object.entries(statusUrlRegistry)) {
    try { await checkStatuspageGroup(urlId, group); }
    catch (err) { console.log(`[${new Date().toISOString()}] ⚠️  ${urlId}: ${err.message}`); }
    await sleep(800);
  }

  // Check health-check services
  for (const svc of STATUS_PAGES.filter(s => s.type === 'healthcheck')) {
    try { await checkHealthService(svc); }
    catch (err) { console.log(`[${new Date().toISOString()}] ⚠️  ${svc.name}: ${err.message}`); }
    await sleep(400);
  }

  console.log(`[${new Date().toISOString()}] ✅ Check done. Issues: ${currentOutages.size} | Tweets sent: ${totalTweets}`);
}

// ── Keep-alive HTTP server (prevents Render from sleeping) ────────────
function startServer() {
  require('http').createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status:            'running',
      version:           '7.0',
      uptime_mins:       Math.floor((Date.now() - botStartTime) / 60000),
      services_tracked:  STATUS_PAGES.length,
      official_apis:     statusPageCount,
      health_checks:     healthCheckCount,
      x_api_usage:       'write only — tweets on outage/recovery/update',
      active_issues:     currentOutages.size,
      total_tweets:      totalTweets,
      last_check:        lastCheckTime?.toISOString() || 'pending',
    }));
  }).listen(PORT, () =>
    console.log(`[${new Date().toISOString()}] 🌐 Health server on port ${PORT}`)
  );
}

// ── Self-ping (keeps Render paid instance responsive) ─────────────────
function startPing() {
  const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  setInterval(() => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, res => { res.resume(); console.log(`[${new Date().toISOString()}] 🏓 Ping OK`); })
       .on('error', e => console.log(`[${new Date().toISOString()}] 🏓 Ping failed: ${e.message}`));
  }, PING_EVERY);
}

// ── Boot sequence ─────────────────────────────────────────────────────
async function boot() {
  console.log(`\n${'═'.repeat(62)}`);
  console.log(`  AIStatusHub Bot v7.0`);
  console.log(`  Tracking ${STATUS_PAGES.length} AI services`);
  console.log(`  Status checks: ${statusPageCount} official APIs + ${healthCheckCount} HTTP health checks`);
  console.log(`  X API: write-only — never used to READ status`);
  console.log(`  Tweets: outages, incident updates & recoveries ONLY`);
  console.log(`${'═'.repeat(62)}\n`);

  startServer();

  // Seed initial state silently — no tweets on boot
  console.log(`[${new Date().toISOString()}] 🌱 Seeding initial state (no tweets)...`);
  for (const [urlId, group] of Object.entries(statusUrlRegistry)) {
    try {
      const data = await fetchJSON(group.url);
      for (const inc of (data.incidents || [])) {
        seenIncidents.add(inc.id);
        for (const upd of (inc.incident_updates || [])) seenIncidentUpdates.add(upd.id);
      }
      for (const c of (data.components || [])) {
        if (!c.group) {
          lastComponentStatus[`${urlId}::${c.id}`] = c.status;
          if (c.status !== 'operational') {
            const gName = group.services.map(s => s.name).join(' / ');
            currentOutages.set(`${urlId}::${c.id}`, { name: gName, component: c.name, status: c.status });
          }
        }
      }
    } catch (e) { console.log(`  ⚠️  Seed [${urlId}]: ${e.message}`); }
    await sleep(300);
  }
  for (const svc of STATUS_PAGES.filter(s => s.type === 'healthcheck')) {
    try {
      const up = await checkHealth(svc.healthUrl);
      healthStatus[svc.id] = up ? 'up' : 'down';
      if (!up) currentOutages.set(svc.id, { name: svc.name, component: svc.name, status: 'down' });
    } catch { /* ignore */ }
    await sleep(200);
  }
  console.log(`[${new Date().toISOString()}] ✅ Seeded. Current issues: ${currentOutages.size}`);

  startPing();

  // Start monitoring loop
  setInterval(checkAll, CHECK_EVERY);
  setTimeout(checkAll, 30 * 1000); // first check 30s after boot

  console.log(`[${new Date().toISOString()}] 🤖 Bot v7.0 live. Checks every 5 min. X API = write-only.`);
}

// Crash protection
process.on('uncaughtException',  e => console.error('[UNCAUGHT]',  e.message));
process.on('unhandledRejection', e => console.error('[UNHANDLED]', e));

boot();
