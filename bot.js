// AIStatusHub — Professional Status Monitor Bot v3.0
// Monitors 39 AI services — status page APIs + HTTP health checks
// Runs 24/7 on Render paid tier

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
const CHECK_EVERY   = 5  * 60 * 1000;       // check every 5 min
const SUMMARY_EVERY = 6  * 60 * 60 * 1000;  // summary every 6 hrs
const PING_EVERY    = 14 * 60 * 1000;        // self-ping every 14 min
const SITE_URL      = 'https://aistatushub.com';
const PORT          = process.env.PORT || 3000;

// ── 39 Services ─────────────────────────────────────────────────────
// type: 'statuspage' = has statuspage.io API (full incident tracking)
// type: 'healthcheck' = no public API, we check if the site responds
const STATUS_PAGES = [
  // ── General AI ──
  { id:'chatgpt',      name:'ChatGPT',            type:'statuspage',  url:'https://status.openai.com/api/v2/summary.json',          healthUrl:'https://chatgpt.com',               hashtags:'#ChatGPT #OpenAI',            pageUrl:`${SITE_URL}/chatgpt-status.html` },
  { id:'claude',       name:'Claude',             type:'statuspage',  url:'https://status.anthropic.com/api/v2/summary.json',       healthUrl:'https://claude.ai',                 hashtags:'#Claude #Anthropic',          pageUrl:`${SITE_URL}/claude-status.html` },
  { id:'gemini',       name:'Google Gemini',      type:'healthcheck', url:null,                                                     healthUrl:'https://gemini.google.com',         hashtags:'#Gemini #Google',             pageUrl:`${SITE_URL}/gemini-status.html` },
  { id:'grok',         name:'Grok',               type:'statuspage',  url:'https://status.x.ai/api/v2/summary.json',                healthUrl:'https://grok.com',                  hashtags:'#Grok #xAI',                  pageUrl:`${SITE_URL}/grok-status.html` },
  { id:'perplexity',   name:'Perplexity AI',      type:'statuspage',  url:'https://status.perplexity.ai/api/v2/summary.json',       healthUrl:'https://perplexity.ai',             hashtags:'#Perplexity #AI',             pageUrl:`${SITE_URL}/perplexity-status.html` },
  { id:'mscopilot',    name:'Microsoft Copilot',  type:'healthcheck', url:null,                                                     healthUrl:'https://copilot.microsoft.com',     hashtags:'#MicrosoftCopilot #Microsoft',pageUrl:`${SITE_URL}/mscopilot-status.html` },
  { id:'mistral',      name:'Mistral AI',         type:'statuspage',  url:'https://status.mistral.ai/api/v2/summary.json',          healthUrl:'https://mistral.ai',                hashtags:'#MistralAI #AI',              pageUrl:`${SITE_URL}/mistral-status.html` },
  { id:'llama',        name:'Meta Llama',         type:'healthcheck', url:null,                                                     healthUrl:'https://llama.meta.com',            hashtags:'#MetaLlama #Meta',            pageUrl:`${SITE_URL}/llama-status.html` },
  { id:'cohere',       name:'Cohere',             type:'statuspage',  url:'https://status.cohere.com/api/v2/summary.json',          healthUrl:'https://cohere.com',                hashtags:'#Cohere #AI',                 pageUrl:`${SITE_URL}/cohere-status.html` },
  { id:'huggingface',  name:'Hugging Face',       type:'statuspage',  url:'https://status.huggingface.co/api/v2/summary.json',      healthUrl:'https://huggingface.co',            hashtags:'#HuggingFace #AI',            pageUrl:`${SITE_URL}/huggingface-status.html` },
  { id:'deepl',        name:'DeepL',              type:'healthcheck', url:null,                                                     healthUrl:'https://deepl.com',                 hashtags:'#DeepL #Translation',         pageUrl:`${SITE_URL}/deepl-status.html` },
  { id:'canva',        name:'Canva AI',           type:'healthcheck', url:null,                                                     healthUrl:'https://canva.com',                 hashtags:'#Canva #AIDesign',            pageUrl:`${SITE_URL}/canva-status.html` },
  { id:'you',          name:'You.com',            type:'healthcheck', url:null,                                                     healthUrl:'https://you.com',                   hashtags:'#YouCom #AI',                 pageUrl:`${SITE_URL}/you-status.html` },
  { id:'together',     name:'Together AI',        type:'statuspage',  url:'https://status.together.ai/api/v2/summary.json',         healthUrl:'https://together.ai',               hashtags:'#TogetherAI #AI',             pageUrl:`${SITE_URL}/together-status.html` },

  // ── Coding & Dev ──
  { id:'copilot',      name:'GitHub Copilot',     type:'statuspage',  url:'https://www.githubstatus.com/api/v2/summary.json',       healthUrl:'https://github.com',                hashtags:'#GitHubCopilot #GitHub',      pageUrl:`${SITE_URL}/copilot-status.html` },
  { id:'cursor',       name:'Cursor',             type:'healthcheck', url:null,                                                     healthUrl:'https://cursor.com',                hashtags:'#Cursor #AI',                 pageUrl:`${SITE_URL}/cursor-status.html` },
  { id:'claudecode',   name:'Claude Code',        type:'statuspage',  url:'https://status.anthropic.com/api/v2/summary.json',       healthUrl:'https://claude.ai',                 hashtags:'#ClaudeCode #Anthropic',      pageUrl:`${SITE_URL}/claudecode-status.html` },
  { id:'amazonq',      name:'Amazon Q',           type:'healthcheck', url:null,                                                     healthUrl:'https://aws.amazon.com/q',          hashtags:'#AmazonQ #AWS',               pageUrl:`${SITE_URL}/amazonq-status.html` },
  { id:'replit',       name:'Replit AI',          type:'statuspage',  url:'https://status.replit.com/api/v2/summary.json',          healthUrl:'https://replit.com',                hashtags:'#Replit #AI',                 pageUrl:`${SITE_URL}/replit-status.html` },
  { id:'phind',        name:'Phind',              type:'healthcheck', url:null,                                                     healthUrl:'https://phind.com',                 hashtags:'#Phind #AI',                  pageUrl:`${SITE_URL}/phind-status.html` },

  // ── Visuals, Audio & Video ──
  { id:'midjourney',   name:'Midjourney',         type:'healthcheck', url:null,                                                     healthUrl:'https://midjourney.com',            hashtags:'#Midjourney #AIArt',          pageUrl:`${SITE_URL}/midjourney-status.html` },
  { id:'dalle',        name:'DALL·E 3',           type:'statuspage',  url:'https://status.openai.com/api/v2/summary.json',          healthUrl:'https://openai.com',                hashtags:'#DALLE3 #OpenAI',             pageUrl:`${SITE_URL}/dalle-status.html` },
  { id:'adobefirefly', name:'Adobe Firefly',      type:'healthcheck', url:null,                                                     healthUrl:'https://firefly.adobe.com',         hashtags:'#AdobeFirefly #Adobe',        pageUrl:`${SITE_URL}/adobefirefly-status.html` },
  { id:'stability',    name:'Stability AI',       type:'healthcheck', url:null,                                                     healthUrl:'https://stability.ai',              hashtags:'#StabilityAI #AIArt',         pageUrl:`${SITE_URL}/stability-status.html` },
  { id:'runway',       name:'Runway',             type:'statuspage',  url:'https://status.runway.team/api/v2/summary.json',         healthUrl:'https://runwayml.com',              hashtags:'#Runway #AIVideo',            pageUrl:`${SITE_URL}/runway-status.html` },
  { id:'sora',         name:'Sora',               type:'statuspage',  url:'https://status.openai.com/api/v2/summary.json',          healthUrl:'https://openai.com',                hashtags:'#Sora #OpenAI',               pageUrl:`${SITE_URL}/sora-status.html` },
  { id:'googleveo',    name:'Google Veo',         type:'healthcheck', url:null,                                                     healthUrl:'https://deepmind.google/technologies/veo', hashtags:'#GoogleVeo #Google',   pageUrl:`${SITE_URL}/googleveo-status.html` },
  { id:'synthesia',    name:'Synthesia',          type:'statuspage',  url:'https://status.synthesia.io/api/v2/summary.json',        healthUrl:'https://synthesia.io',              hashtags:'#Synthesia #AIVideo',         pageUrl:`${SITE_URL}/synthesia-status.html` },
  { id:'elevenlabs',   name:'ElevenLabs',         type:'statuspage',  url:'https://status.elevenlabs.io/api/v2/summary.json',       healthUrl:'https://elevenlabs.io',             hashtags:'#ElevenLabs #AIVoice',        pageUrl:`${SITE_URL}/elevenlabs-status.html` },
  { id:'flux',         name:'Flux (BFL)',         type:'healthcheck', url:null,                                                     healthUrl:'https://blackforestlabs.ai',        hashtags:'#Flux #AIArt',                pageUrl:`${SITE_URL}/flux-status.html` },
  { id:'ideogram',     name:'Ideogram',           type:'statuspage',  url:'https://status.ideogram.ai/api/v2/summary.json',         healthUrl:'https://ideogram.ai',               hashtags:'#Ideogram #AIArt',            pageUrl:`${SITE_URL}/ideogram-status.html` },
  { id:'suno',         name:'Suno',               type:'healthcheck', url:null,                                                     healthUrl:'https://suno.com',                  hashtags:'#Suno #AIMusic',              pageUrl:`${SITE_URL}/suno-status.html` },

  // ── Business, Content & Data ──
  { id:'jasper',       name:'Jasper AI',          type:'healthcheck', url:null,                                                     healthUrl:'https://jasper.ai',                 hashtags:'#Jasper #AI',                 pageUrl:`${SITE_URL}/jasper-status.html` },
  { id:'grammarly',    name:'Grammarly',          type:'statuspage',  url:'https://status.grammarly.com/api/v2/summary.json',       healthUrl:'https://grammarly.com',             hashtags:'#Grammarly #AI',              pageUrl:`${SITE_URL}/grammarly-status.html` },
  { id:'notionai',     name:'Notion AI',          type:'statuspage',  url:'https://status.notion.so/api/v2/summary.json',           healthUrl:'https://notion.so',                 hashtags:'#NotionAI #Notion',           pageUrl:`${SITE_URL}/notionai-status.html` },
  { id:'glean',        name:'Glean',              type:'healthcheck', url:null,                                                     healthUrl:'https://glean.com',                 hashtags:'#Glean #AI',                  pageUrl:`${SITE_URL}/glean-status.html` },
  { id:'writer',       name:'Writer',             type:'statuspage',  url:'https://status.writer.com/api/v2/summary.json',          healthUrl:'https://writer.com',                hashtags:'#Writer #AI',                 pageUrl:`${SITE_URL}/writer-status.html` },
  { id:'anomalyai',    name:'Anomaly AI',         type:'healthcheck', url:null,                                                     healthUrl:'https://anomaly.ai',                hashtags:'#AnomalyAI #DataAI',          pageUrl:`${SITE_URL}/anomalyai-status.html` },
  { id:'ada',          name:'Ada',                type:'healthcheck', url:null,                                                     healthUrl:'https://ada.cx',                    hashtags:'#Ada #AI',                    pageUrl:`${SITE_URL}/ada-status.html` },
];

// ── State ───────────────────────────────────────────────────────────
const seenIncidents       = new Set();
const lastComponentStatus = {};
const currentOutages      = new Map(); // key -> { name, component, status }
const healthStatus        = {};        // id -> 'up' | 'down'
let   totalTweets         = 0;
let   lastCheckTime       = null;
const botStartTime        = new Date();

// ── Helpers ─────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

function fetchJSON(url, hops = 0) {
  return new Promise((resolve, reject) => {
    if (hops > 5) return reject(new Error('Too many redirects'));
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, {
      headers: { 'User-Agent': 'AIStatusHub/3.0', 'Accept': 'application/json' }
    }, res => {
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
        const next = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        res.resume();
        return resolve(fetchJSON(next, hops + 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { reject(new Error('Bad JSON')); } });
    }).on('error', reject)
      .setTimeout(12000, function() { this.destroy(); reject(new Error('Timeout')); });
  });
}

function checkHealth(url) {
  return new Promise(resolve => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': 'AIStatusHub/3.0' } }, res => {
      res.resume();
      resolve(res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(10000, () => { req.destroy(); resolve(false); });
  });
}

// ── Tweet ────────────────────────────────────────────────────────────
async function tweet(text) {
  if (text.length > 280) text = text.slice(0, 277) + '...';
  try {
    await rwClient.v2.tweet(text);
    totalTweets++;
    console.log(`[${new Date().toISOString()}] ✅ TWEET #${totalTweets}: ${text.slice(0,70)}...`);
    return true;
  } catch (err) {
    console.error(`[${new Date().toISOString()}] ❌ TWEET FAILED: ${err?.data?.detail || err.message}`);
    return false;
  }
}

// ── Check one statuspage.io service ─────────────────────────────────
async function checkStatuspage(svc) {
  const data = await fetchJSON(svc.url);

  // Active incidents
  for (const inc of (data.incidents || [])) {
    if (seenIncidents.has(inc.id)) continue;
    seenIncidents.add(inc.id);
    const update = inc.incident_updates?.[0]?.body || inc.name || 'Service disruption';
    const impact = inc.impact || 'minor';
    const status = inc.status || 'investigating';
    const emoji  = { critical:'🚨', major:'⚠️', minor:'🟡' }[impact] || '📢';
    await tweet(
      `${emoji} ${svc.name} — ${status.toUpperCase()}\n\n` +
      `${update.slice(0, 150)}${update.length > 150 ? '...' : ''}\n\n` +
      `Live status → ${svc.pageUrl}\n${svc.hashtags} #AIStatus`
    );
    await sleep(3000);
  }

  // Component changes
  for (const comp of (data.components || [])) {
    if (comp.group) continue;
    const key  = `${svc.id}::${comp.id}`;
    const prev = lastComponentStatus[key];
    lastComponentStatus[key] = comp.status;
    if (prev === undefined) {
      if (comp.status !== 'operational') currentOutages.set(key, { name: svc.name, component: comp.name, status: comp.status });
      continue;
    }
    if (prev === comp.status) continue;
    if (comp.status === 'operational') {
      currentOutages.delete(key);
      await tweet(`✅ ${svc.name} — "${comp.name}" restored to OPERATIONAL\n\nFull status → ${svc.pageUrl}\n${svc.hashtags} #AIStatus`);
    } else {
      currentOutages.set(key, { name: svc.name, component: comp.name, status: comp.status });
      const e = { major_outage:'🔴', partial_outage:'🟠', degraded_performance:'🟡' }[comp.status] || '🟡';
      await tweet(`${e} ${svc.name} — "${comp.name}" is ${comp.status.replace(/_/g,' ').toUpperCase()}\n\nLive status → ${svc.pageUrl}\n${svc.hashtags} #AIStatus #AIOutage`);
    }
    await sleep(3000);
  }
}

// ── Check one health-check service ──────────────────────────────────
async function checkHealthService(svc) {
  const isUp   = await checkHealth(svc.healthUrl);
  const prev   = healthStatus[svc.id];
  healthStatus[svc.id] = isUp ? 'up' : 'down';

  if (prev === undefined) {
    // First check — seed state, no tweet
    if (!isUp) currentOutages.set(svc.id, { name: svc.name, component: svc.name, status: 'down' });
    return;
  }

  if (prev === 'up' && !isUp) {
    // Just went down
    currentOutages.set(svc.id, { name: svc.name, component: svc.name, status: 'down' });
    await tweet(`🔴 ${svc.name} appears to be DOWN\n\nWe detected the service is not responding. Monitor live → ${svc.pageUrl}\n${svc.hashtags} #AIStatus #AIOutage`);
  } else if (prev === 'down' && isUp) {
    // Just recovered
    currentOutages.delete(svc.id);
    await tweet(`✅ ${svc.name} is back ONLINE\n\nService has recovered and is responding normally.\nFull status → ${svc.pageUrl}\n${svc.hashtags} #AIStatus`);
  }
}

// ── Check all 39 services ────────────────────────────────────────────
async function checkAll() {
  lastCheckTime = new Date();
  console.log(`[${lastCheckTime.toISOString()}] 🔍 Checking all ${STATUS_PAGES.length} services...`);

  for (const svc of STATUS_PAGES) {
    try {
      if (svc.type === 'statuspage') {
        await checkStatuspage(svc);
      } else {
        await checkHealthService(svc);
      }
    } catch (err) {
      console.log(`[${new Date().toISOString()}] ⚠️  ${svc.name}: ${err.message}`);
    }
    await sleep(800);
  }

  const issues = currentOutages.size;
  console.log(`[${new Date().toISOString()}] ✅ Done. Active issues: ${issues}`);
}

// ── 6-hour summary ───────────────────────────────────────────────────
async function tweetSummary() {
  const timeStr   = new Date().toUTCString().replace(' GMT','') + ' UTC';
  const outages   = [...new Set([...currentOutages.values()].map(o => o.name))];
  const downCount = outages.length;
  const okCount   = STATUS_PAGES.length - downCount;

  let text;
  if (downCount === 0) {
    text =
      `📊 AI Status Report — ${timeStr}\n\n` +
      `✅ All ${STATUS_PAGES.length} monitored AI services are OPERATIONAL\n\n` +
      `Tracking: ChatGPT, Claude, Gemini, Midjourney + ${STATUS_PAGES.length - 4} more\n\n` +
      `Full dashboard → ${SITE_URL}\n` +
      `#AIStatus #AITools #StatusUpdate`;
  } else {
    const list = outages.slice(0, 4).join(', ');
    const more = outages.length > 4 ? ` +${outages.length - 4} more` : '';
    text =
      `📊 AI Status Report — ${timeStr}\n\n` +
      `🔴 ${downCount} service(s) with issues:\n${list}${more}\n\n` +
      `✅ ${okCount}/${STATUS_PAGES.length} services operational\n\n` +
      `Full dashboard → ${SITE_URL}\n` +
      `#AIStatus #AIOutage #AITools`;
  }
  await tweet(text);
}

// ── Keep-alive HTTP server ───────────────────────────────────────────
function startServer() {
  require('http').createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status:        'running',
      uptime_mins:   Math.floor((Date.now() - botStartTime) / 60000),
      services:      STATUS_PAGES.length,
      active_issues: currentOutages.size,
      total_tweets:  totalTweets,
      last_check:    lastCheckTime?.toISOString() || 'pending',
    }));
  }).listen(PORT, () => console.log(`[${new Date().toISOString()}] 🌐 Health server on port ${PORT}`));
}

// ── Self-ping ────────────────────────────────────────────────────────
function startPing() {
  const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  setInterval(() => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, res => { res.resume(); console.log(`[${new Date().toISOString()}] 🏓 Ping OK`); })
       .on('error', e => console.log(`[${new Date().toISOString()}] 🏓 Ping failed: ${e.message}`));
  }, PING_EVERY);
}

// ── Boot ─────────────────────────────────────────────────────────────
async function boot() {
  console.log(`\n${'═'.repeat(55)}`);
  console.log(`  AIStatusHub Bot v3.0`);
  console.log(`  Tracking ${STATUS_PAGES.length} AI services`);
  console.log(`  ${STATUS_PAGES.filter(s=>s.type==='statuspage').length} with status APIs, ${STATUS_PAGES.filter(s=>s.type==='healthcheck').length} with health checks`);
  console.log(`${'═'.repeat(55)}\n`);

  startServer();

  // Seed silently
  console.log(`[${new Date().toISOString()}] 🌱 Seeding initial state (no tweets)...`);
  for (const svc of STATUS_PAGES) {
    try {
      if (svc.type === 'statuspage') {
        const data = await fetchJSON(svc.url);
        (data.incidents  || []).forEach(i => seenIncidents.add(i.id));
        (data.components || []).forEach(c => {
          if (!c.group) {
            lastComponentStatus[`${svc.id}::${c.id}`] = c.status;
            if (c.status !== 'operational')
              currentOutages.set(`${svc.id}::${c.id}`, { name: svc.name, component: c.name, status: c.status });
          }
        });
      } else {
        const up = await checkHealth(svc.healthUrl);
        healthStatus[svc.id] = up ? 'up' : 'down';
        if (!up) currentOutages.set(svc.id, { name: svc.name, component: svc.name, status: 'down' });
      }
    } catch { /* ignore on boot */ }
    await sleep(300);
  }
  console.log(`[${new Date().toISOString()}] ✅ Seeded. Known issues: ${currentOutages.size}`);

  await tweetSummary();
  startPing();

  // Start loops
  setInterval(checkAll, CHECK_EVERY);
  setInterval(tweetSummary, SUMMARY_EVERY);
  setTimeout(checkAll, 60 * 1000); // first check after 60s
}

process.on('uncaughtException',  e => console.error('[UNCAUGHT]', e.message));
process.on('unhandledRejection', e => console.error('[UNHANDLED]', e));

boot();
