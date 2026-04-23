// AIStatusHub — Professional Status Monitor Bot v6.0
// Tweets on: outages, recoveries, incident updates, AND official news/releases
// No summary tweets — only event-driven tweets

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
const CHECK_EVERY      = 5  * 60 * 1000;  // status checks every 5 min
const NEWS_CHECK_EVERY = 30 * 60 * 1000;  // news checks every 30 min
const PING_EVERY       = 14 * 60 * 1000;  // self-ping every 14 min
const SITE_URL         = 'https://aistatushub.com';
const PORT             = process.env.PORT || 3000;

// ── News feeds — official blogs/release pages for each service ──────
// We fetch these as HTML/RSS and look for new article titles
const NEWS_FEEDS = [
  { id:'openai',       name:'OpenAI',           url:'https://openai.com/news/rss.xml',                        type:'rss',  hashtags:'#OpenAI #ChatGPT',     pageUrl:'https://openai.com/news' },
  { id:'anthropic',    name:'Anthropic',         url:'https://www.anthropic.com/rss.xml',                      type:'rss',  hashtags:'#Anthropic #Claude',   pageUrl:'https://anthropic.com/news' },
  { id:'google',       name:'Google AI',         url:'https://blog.google/technology/ai/rss/',                 type:'rss',  hashtags:'#Google #Gemini',      pageUrl:'https://blog.google/technology/ai' },
  { id:'xai',          name:'xAI',               url:'https://x.ai/news/rss.xml',                              type:'rss',  hashtags:'#xAI #Grok',           pageUrl:'https://x.ai/news' },
  { id:'mistral',      name:'Mistral AI',        url:'https://mistral.ai/news/rss',                            type:'rss',  hashtags:'#MistralAI',           pageUrl:'https://mistral.ai/news' },
  { id:'perplexity',   name:'Perplexity AI',     url:'https://www.perplexity.ai/hub/blog/rss.xml',             type:'rss',  hashtags:'#Perplexity',          pageUrl:'https://perplexity.ai/hub/blog' },
  { id:'huggingface',  name:'Hugging Face',      url:'https://huggingface.co/blog/feed.xml',                   type:'rss',  hashtags:'#HuggingFace',         pageUrl:'https://huggingface.co/blog' },
  { id:'elevenlabs',   name:'ElevenLabs',        url:'https://elevenlabs.io/blog/rss.xml',                     type:'rss',  hashtags:'#ElevenLabs',          pageUrl:'https://elevenlabs.io/blog' },
  { id:'runwayml',     name:'Runway',            url:'https://runwayml.com/blog/rss.xml',                      type:'rss',  hashtags:'#Runway #AIVideo',     pageUrl:'https://runwayml.com/blog' },
  { id:'github',       name:'GitHub',            url:'https://github.blog/feed/',                              type:'rss',  hashtags:'#GitHub #GitHubCopilot',pageUrl:'https://github.blog' },
  { id:'replit',       name:'Replit',            url:'https://blog.replit.com/rss.xml',                        type:'rss',  hashtags:'#Replit',              pageUrl:'https://blog.replit.com' },
  { id:'notionai',     name:'Notion',            url:'https://www.notion.so/blog/rss.xml',                     type:'rss',  hashtags:'#Notion #NotionAI',    pageUrl:'https://notion.so/blog' },
  { id:'grammarly',    name:'Grammarly',         url:'https://www.grammarly.com/blog/feed/',                   type:'rss',  hashtags:'#Grammarly',           pageUrl:'https://grammarly.com/blog' },
  { id:'midjourney',   name:'Midjourney',        url:'https://midjourney.com/updates/rss.xml',                 type:'rss',  hashtags:'#Midjourney #AIArt',   pageUrl:'https://midjourney.com/updates' },
  { id:'stability',    name:'Stability AI',      url:'https://stability.ai/news/rss.xml',                      type:'rss',  hashtags:'#StabilityAI',         pageUrl:'https://stability.ai/news' },
  { id:'cohere',       name:'Cohere',            url:'https://cohere.com/blog/rss.xml',                        type:'rss',  hashtags:'#Cohere',              pageUrl:'https://cohere.com/blog' },
  { id:'together',     name:'Together AI',       url:'https://www.together.ai/blog/rss.xml',                   type:'rss',  hashtags:'#TogetherAI',          pageUrl:'https://together.ai/blog' },
  { id:'ideogram',     name:'Ideogram',          url:'https://about.ideogram.ai/blog/rss.xml',                 type:'rss',  hashtags:'#Ideogram #AIArt',     pageUrl:'https://about.ideogram.ai/blog' },
  { id:'synthesia',    name:'Synthesia',         url:'https://www.synthesia.io/post/rss.xml',                  type:'rss',  hashtags:'#Synthesia',           pageUrl:'https://synthesia.io/blog' },
  { id:'writer',       name:'Writer',            url:'https://writer.com/blog/rss.xml',                        type:'rss',  hashtags:'#Writer',              pageUrl:'https://writer.com/blog' },
];

// ── 39 Status-monitored services ───────────────────────────────────
const STATUS_PAGES = [
  { id:'chatgpt',      name:'ChatGPT',           type:'statuspage',  statusUrlId:'openai',       url:'https://status.openai.com/api/v2/summary.json',        healthUrl:'https://chatgpt.com',                      hashtags:'#ChatGPT #OpenAI',            pageUrl:`${SITE_URL}/chatgpt-status.html` },
  { id:'claude',       name:'Claude',            type:'statuspage',  statusUrlId:'anthropic',    url:'https://status.anthropic.com/api/v2/summary.json',     healthUrl:'https://claude.ai',                        hashtags:'#Claude #Anthropic',          pageUrl:`${SITE_URL}/claude-status.html` },
  { id:'gemini',       name:'Google Gemini',     type:'healthcheck', statusUrlId:'gemini',       url:null,                                                   healthUrl:'https://gemini.google.com',                hashtags:'#Gemini #Google',             pageUrl:`${SITE_URL}/gemini-status.html` },
  { id:'grok',         name:'Grok',              type:'statuspage',  statusUrlId:'grok',         url:'https://status.x.ai/api/v2/summary.json',              healthUrl:'https://grok.com',                         hashtags:'#Grok #xAI',                  pageUrl:`${SITE_URL}/grok-status.html` },
  { id:'perplexity',   name:'Perplexity AI',     type:'statuspage',  statusUrlId:'perplexity',   url:'https://status.perplexity.ai/api/v2/summary.json',     healthUrl:'https://perplexity.ai',                    hashtags:'#Perplexity #AI',             pageUrl:`${SITE_URL}/perplexity-status.html` },
  { id:'mscopilot',    name:'Microsoft Copilot', type:'healthcheck', statusUrlId:'mscopilot',    url:null,                                                   healthUrl:'https://copilot.microsoft.com',            hashtags:'#MicrosoftCopilot #Microsoft',pageUrl:`${SITE_URL}/mscopilot-status.html` },
  { id:'mistral',      name:'Mistral AI',        type:'statuspage',  statusUrlId:'mistral',      url:'https://status.mistral.ai/api/v2/summary.json',        healthUrl:'https://mistral.ai',                       hashtags:'#MistralAI #AI',              pageUrl:`${SITE_URL}/mistral-status.html` },
  { id:'llama',        name:'Meta Llama',        type:'healthcheck', statusUrlId:'llama',        url:null,                                                   healthUrl:'https://llama.meta.com',                   hashtags:'#MetaLlama #Meta',            pageUrl:`${SITE_URL}/llama-status.html` },
  { id:'cohere',       name:'Cohere',            type:'statuspage',  statusUrlId:'cohere',       url:'https://status.cohere.com/api/v2/summary.json',        healthUrl:'https://cohere.com',                       hashtags:'#Cohere #AI',                 pageUrl:`${SITE_URL}/cohere-status.html` },
  { id:'huggingface',  name:'Hugging Face',      type:'statuspage',  statusUrlId:'huggingface',  url:'https://status.huggingface.co/api/v2/summary.json',    healthUrl:'https://huggingface.co',                   hashtags:'#HuggingFace #AI',            pageUrl:`${SITE_URL}/huggingface-status.html` },
  { id:'deepl',        name:'DeepL',             type:'healthcheck', statusUrlId:'deepl',        url:null,                                                   healthUrl:'https://deepl.com',                        hashtags:'#DeepL #Translation',         pageUrl:`${SITE_URL}/deepl-status.html` },
  { id:'canva',        name:'Canva AI',          type:'healthcheck', statusUrlId:'canva',        url:null,                                                   healthUrl:'https://canva.com',                        hashtags:'#Canva #AIDesign',            pageUrl:`${SITE_URL}/canva-status.html` },
  { id:'you',          name:'You.com',           type:'healthcheck', statusUrlId:'you',          url:null,                                                   healthUrl:'https://you.com',                          hashtags:'#YouCom #AI',                 pageUrl:`${SITE_URL}/you-status.html` },
  { id:'together',     name:'Together AI',       type:'statuspage',  statusUrlId:'together',     url:'https://status.together.ai/api/v2/summary.json',       healthUrl:'https://together.ai',                      hashtags:'#TogetherAI #AI',             pageUrl:`${SITE_URL}/together-status.html` },
  { id:'copilot',      name:'GitHub Copilot',    type:'statuspage',  statusUrlId:'github',       url:'https://www.githubstatus.com/api/v2/summary.json',     healthUrl:'https://github.com',                       hashtags:'#GitHubCopilot #GitHub',      pageUrl:`${SITE_URL}/copilot-status.html` },
  { id:'cursor',       name:'Cursor',            type:'healthcheck', statusUrlId:'cursor',       url:null,                                                   healthUrl:'https://cursor.com',                       hashtags:'#Cursor #AI',                 pageUrl:`${SITE_URL}/cursor-status.html` },
  { id:'claudecode',   name:'Claude Code',       type:'statuspage',  statusUrlId:'anthropic',    url:'https://status.anthropic.com/api/v2/summary.json',     healthUrl:'https://claude.ai',                        hashtags:'#ClaudeCode #Anthropic',      pageUrl:`${SITE_URL}/claudecode-status.html` },
  { id:'amazonq',      name:'Amazon Q',          type:'healthcheck', statusUrlId:'amazonq',      url:null,                                                   healthUrl:'https://aws.amazon.com/q',                 hashtags:'#AmazonQ #AWS',               pageUrl:`${SITE_URL}/amazonq-status.html` },
  { id:'replit',       name:'Replit AI',         type:'statuspage',  statusUrlId:'replit',       url:'https://status.replit.com/api/v2/summary.json',        healthUrl:'https://replit.com',                       hashtags:'#Replit #AI',                 pageUrl:`${SITE_URL}/replit-status.html` },
  { id:'phind',        name:'Phind',             type:'healthcheck', statusUrlId:'phind',        url:null,                                                   healthUrl:'https://phind.com',                        hashtags:'#Phind #AI',                  pageUrl:`${SITE_URL}/phind-status.html` },
  { id:'midjourney',   name:'Midjourney',        type:'healthcheck', statusUrlId:'midjourney',   url:null,                                                   healthUrl:'https://midjourney.com',                   hashtags:'#Midjourney #AIArt',          pageUrl:`${SITE_URL}/midjourney-status.html` },
  { id:'dalle',        name:'DALL·E 3',          type:'statuspage',  statusUrlId:'openai',       url:'https://status.openai.com/api/v2/summary.json',        healthUrl:'https://openai.com',                       hashtags:'#DALLE3 #OpenAI',             pageUrl:`${SITE_URL}/dalle-status.html` },
  { id:'sora',         name:'Sora',              type:'statuspage',  statusUrlId:'openai',       url:'https://status.openai.com/api/v2/summary.json',        healthUrl:'https://openai.com',                       hashtags:'#Sora #OpenAI',               pageUrl:`${SITE_URL}/sora-status.html` },
  { id:'adobefirefly', name:'Adobe Firefly',     type:'healthcheck', statusUrlId:'adobefirefly', url:null,                                                   healthUrl:'https://firefly.adobe.com',                hashtags:'#AdobeFirefly #Adobe',        pageUrl:`${SITE_URL}/adobefirefly-status.html` },
  { id:'stability',    name:'Stability AI',      type:'healthcheck', statusUrlId:'stability',    url:null,                                                   healthUrl:'https://stability.ai',                     hashtags:'#StabilityAI #AIArt',         pageUrl:`${SITE_URL}/stability-status.html` },
  { id:'runway',       name:'Runway',            type:'statuspage',  statusUrlId:'runway',       url:'https://status.runway.team/api/v2/summary.json',       healthUrl:'https://runwayml.com',                     hashtags:'#Runway #AIVideo',            pageUrl:`${SITE_URL}/runway-status.html` },
  { id:'googleveo',    name:'Google Veo',        type:'healthcheck', statusUrlId:'googleveo',    url:null,                                                   healthUrl:'https://deepmind.google/technologies/veo', hashtags:'#GoogleVeo #Google',          pageUrl:`${SITE_URL}/googleveo-status.html` },
  { id:'synthesia',    name:'Synthesia',         type:'statuspage',  statusUrlId:'synthesia',    url:'https://status.synthesia.io/api/v2/summary.json',      healthUrl:'https://synthesia.io',                     hashtags:'#Synthesia #AIVideo',         pageUrl:`${SITE_URL}/synthesia-status.html` },
  { id:'elevenlabs',   name:'ElevenLabs',        type:'statuspage',  statusUrlId:'elevenlabs',   url:'https://status.elevenlabs.io/api/v2/summary.json',     healthUrl:'https://elevenlabs.io',                    hashtags:'#ElevenLabs #AIVoice',        pageUrl:`${SITE_URL}/elevenlabs-status.html` },
  { id:'flux',         name:'Flux (BFL)',        type:'healthcheck', statusUrlId:'flux',         url:null,                                                   healthUrl:'https://blackforestlabs.ai',               hashtags:'#Flux #AIArt',                pageUrl:`${SITE_URL}/flux-status.html` },
  { id:'ideogram',     name:'Ideogram',          type:'statuspage',  statusUrlId:'ideogram',     url:'https://status.ideogram.ai/api/v2/summary.json',       healthUrl:'https://ideogram.ai',                      hashtags:'#Ideogram #AIArt',            pageUrl:`${SITE_URL}/ideogram-status.html` },
  { id:'suno',         name:'Suno',              type:'healthcheck', statusUrlId:'suno',         url:null,                                                   healthUrl:'https://suno.com',                         hashtags:'#Suno #AIMusic',              pageUrl:`${SITE_URL}/suno-status.html` },
  { id:'jasper',       name:'Jasper AI',         type:'healthcheck', statusUrlId:'jasper',       url:null,                                                   healthUrl:'https://jasper.ai',                        hashtags:'#Jasper #AI',                 pageUrl:`${SITE_URL}/jasper-status.html` },
  { id:'grammarly',    name:'Grammarly',         type:'statuspage',  statusUrlId:'grammarly',    url:'https://status.grammarly.com/api/v2/summary.json',     healthUrl:'https://grammarly.com',                    hashtags:'#Grammarly #AI',              pageUrl:`${SITE_URL}/grammarly-status.html` },
  { id:'notionai',     name:'Notion AI',         type:'statuspage',  statusUrlId:'notion',       url:'https://status.notion.so/api/v2/summary.json',         healthUrl:'https://notion.so',                        hashtags:'#NotionAI #Notion',           pageUrl:`${SITE_URL}/notionai-status.html` },
  { id:'glean',        name:'Glean',             type:'healthcheck', statusUrlId:'glean',        url:null,                                                   healthUrl:'https://glean.com',                        hashtags:'#Glean #AI',                  pageUrl:`${SITE_URL}/glean-status.html` },
  { id:'writer',       name:'Writer',            type:'statuspage',  statusUrlId:'writer',       url:'https://status.writer.com/api/v2/summary.json',        healthUrl:'https://writer.com',                       hashtags:'#Writer #AI',                 pageUrl:`${SITE_URL}/writer-status.html` },
  { id:'anomalyai',    name:'Anomaly AI',        type:'healthcheck', statusUrlId:'anomalyai',    url:null,                                                   healthUrl:'https://anomaly.ai',                       hashtags:'#AnomalyAI #DataAI',          pageUrl:`${SITE_URL}/anomalyai-status.html` },
  { id:'ada',          name:'Ada',               type:'healthcheck', statusUrlId:'ada',          url:null,                                                   healthUrl:'https://ada.cx',                           hashtags:'#Ada #AI',                    pageUrl:`${SITE_URL}/ada-status.html` },
];

// ── Build deduped status URL registry ───────────────────────────────
const statusUrlRegistry = {};
for (const svc of STATUS_PAGES) {
  if (svc.type !== 'statuspage') continue;
  if (!statusUrlRegistry[svc.statusUrlId]) {
    statusUrlRegistry[svc.statusUrlId] = { url: svc.url, services: [] };
  }
  statusUrlRegistry[svc.statusUrlId].services.push(svc);
}

// ── State ────────────────────────────────────────────────────────────
const seenIncidents       = new Set();
const seenIncidentUpdates = new Set();
const lastComponentStatus = {};
const currentOutages      = new Map();
const healthStatus        = {};
const seenNewsItems       = new Set(); // tracks seen news article URLs/titles
let   totalTweets         = 0;
let   lastStatusCheck     = null;
let   lastNewsCheck       = null;
const botStartTime        = new Date();

// ── Helpers ──────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

function fetchText(url, hops = 0) {
  return new Promise((resolve, reject) => {
    if (hops > 5) return reject(new Error('Too many redirects'));
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, {
      headers: { 'User-Agent': 'AIStatusHub/6.0', 'Accept': 'application/rss+xml, application/xml, text/xml, text/html, application/json' }
    }, res => {
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
        const next = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        res.resume();
        return resolve(fetchText(next, hops + 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    }).on('error', reject)
      .setTimeout(15000, function() { this.destroy(); reject(new Error('Timeout')); });
  });
}

function fetchJSON(url, hops = 0) {
  return fetchText(url, hops).then(d => JSON.parse(d));
}

function checkHealth(url) {
  return new Promise(resolve => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, { headers: { 'User-Agent': 'AIStatusHub/6.0' } }, res => {
      res.resume(); resolve(res.statusCode < 500);
    }).on('error', () => resolve(false))
      .setTimeout(10000, function() { this.destroy(); resolve(false); });
  });
}

// ── Parse RSS feed — extract items ──────────────────────────────────
function parseRSS(xml) {
  const items = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = (block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1]?.trim();
    const link  = (block.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/)  || [])[1]?.trim()
               || (block.match(/<guid[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/guid>/)   || [])[1]?.trim();
    const desc  = (block.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/) || [])[1]?.trim();
    const pubDate = (block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/) || [])[1]?.trim();
    if (title && link) {
      // Strip HTML tags from description
      const cleanDesc = desc ? desc.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').trim() : '';
      items.push({ title, link, desc: cleanDesc.slice(0, 200), pubDate });
    }
  }
  return items;
}

// ── Tweet ─────────────────────────────────────────────────────────────
async function tweet(text) {
  if (text.length > 280) text = text.slice(0, 277) + '...';
  try {
    await rwClient.v2.tweet(text);
    totalTweets++;
    console.log(`[${new Date().toISOString()}] ✅ TWEET #${totalTweets}: ${text.slice(0, 70)}...`);
    return true;
  } catch (err) {
    console.error(`[${new Date().toISOString()}] ❌ TWEET FAILED: ${err?.data?.detail || err.message}`);
    return false;
  }
}

// ── Check news for one feed ───────────────────────────────────────────
async function checkNewsFeed(feed) {
  try {
    const xml   = await fetchText(feed.url);
    const items = parseRSS(xml);
    if (items.length === 0) return;

    for (const item of items.slice(0, 5)) { // only check latest 5 per feed
      // Use URL as unique key, fallback to title
      const key = item.link || item.title;
      if (seenNewsItems.has(key)) continue;
      seenNewsItems.add(key);

      // Skip if this is a seeding run (first time seeing this feed)
      if (!feed._seeded) continue;

      // Build tweet
      const title   = item.title.slice(0, 100);
      const link    = item.link || feed.pageUrl;
      const tweetText =
        `📢 ${feed.name} Update\n\n` +
        `${title}\n\n` +
        `Read more → ${link}\n` +
        `${feed.hashtags} #AI #AINews`;

      await tweet(tweetText);
      await sleep(3000);
    }

    feed._seeded = true;
  } catch (err) {
    console.log(`[${new Date().toISOString()}] ⚠️  News [${feed.name}]: ${err.message}`);
    feed._seeded = true; // mark as seeded even on error to avoid re-seeding
  }
}

// ── Check all news feeds ──────────────────────────────────────────────
async function checkAllNews() {
  lastNewsCheck = new Date();
  console.log(`[${lastNewsCheck.toISOString()}] 📰 Checking ${NEWS_FEEDS.length} news feeds...`);
  for (const feed of NEWS_FEEDS) {
    await checkNewsFeed(feed);
    await sleep(1000);
  }
  console.log(`[${new Date().toISOString()}] 📰 News check complete`);
}

// ── Check one statuspage group (deduped) ──────────────────────────────
async function checkStatuspageGroup(urlId, group) {
  const data = await fetchJSON(group.url);
  const groupName  = group.services.map(s => s.name).join(' / ');
  const pageUrl    = group.services[0].pageUrl;
  const hashtagSet = new Set(group.services.flatMap(s => s.hashtags.split(' ')));
  const hashtags   = [...hashtagSet].slice(0, 4).join(' ');

  // New incidents
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
        `Live status → ${pageUrl}\n` +
        `${hashtags} #AIStatus #AIOutage`
      );
      await sleep(3000);
    }

    // New updates on existing incidents
    for (const upd of (inc.incident_updates || [])) {
      if (seenIncidentUpdates.has(upd.id)) continue;
      seenIncidentUpdates.add(upd.id);
      if (!seenIncidents.has(inc.id)) continue;
      const updStatus = upd.status || status;
      const updEmoji  = updStatus === 'resolved'   ? '✅' :
                        updStatus === 'monitoring' ? '👀' :
                        updStatus === 'identified' ? '🔎' : emoji;
      await tweet(
        `${updEmoji} ${groupName} UPDATE — ${updStatus.toUpperCase()}\n\n` +
        `${upd.body.slice(0, 150)}${upd.body.length > 150 ? '...' : ''}\n\n` +
        `Full incident → ${pageUrl}\n` +
        `${hashtags} #AIStatus`
      );
      await sleep(3000);
    }
  }

  // Component changes
  for (const comp of (data.components || [])) {
    if (comp.group) continue;
    const key  = `${urlId}::${comp.id}`;
    const prev = lastComponentStatus[key];
    lastComponentStatus[key] = comp.status;
    if (prev === undefined) {
      if (comp.status !== 'operational')
        currentOutages.set(key, { name: groupName, component: comp.name, status: comp.status });
      continue;
    }
    if (prev === comp.status) continue;
    if (comp.status === 'operational') {
      currentOutages.delete(key);
      await tweet(`✅ ${groupName} — "${comp.name}" RESTORED\n\nService is back to fully operational.\nFull status → ${pageUrl}\n${hashtags} #AIStatus`);
    } else {
      currentOutages.set(key, { name: groupName, component: comp.name, status: comp.status });
      const e = { major_outage:'🔴', partial_outage:'🟠', degraded_performance:'🟡' }[comp.status] || '🟡';
      await tweet(`${e} ${groupName} — "${comp.name}" is ${comp.status.replace(/_/g,' ').toUpperCase()}\n\nLive status → ${pageUrl}\n${hashtags} #AIStatus #AIOutage`);
    }
    await sleep(3000);
  }
}

// ── Check one health-check service ────────────────────────────────────
async function checkHealthService(svc) {
  const isUp = await checkHealth(svc.healthUrl);
  const prev = healthStatus[svc.id];
  healthStatus[svc.id] = isUp ? 'up' : 'down';
  if (prev === undefined) {
    if (!isUp) currentOutages.set(svc.id, { name: svc.name, component: svc.name, status: 'down' });
    return;
  }
  if (prev === 'up' && !isUp) {
    currentOutages.set(svc.id, { name: svc.name, component: svc.name, status: 'down' });
    await tweet(`🔴 ${svc.name} appears to be DOWN\n\nService is not responding.\nMonitor live → ${svc.pageUrl}\n${svc.hashtags} #AIStatus #AIOutage`);
  } else if (prev === 'down' && isUp) {
    currentOutages.delete(svc.id);
    await tweet(`✅ ${svc.name} is back ONLINE\n\nService has recovered and is responding normally.\nFull status → ${svc.pageUrl}\n${svc.hashtags} #AIStatus`);
  }
}

// ── Check all 39 status services ──────────────────────────────────────
async function checkAllStatus() {
  lastStatusCheck = new Date();
  console.log(`[${lastStatusCheck.toISOString()}] 🔍 Checking ${STATUS_PAGES.length} services...`);
  for (const [urlId, group] of Object.entries(statusUrlRegistry)) {
    try { await checkStatuspageGroup(urlId, group); }
    catch (err) { console.log(`[${new Date().toISOString()}] ⚠️  ${urlId}: ${err.message}`); }
    await sleep(800);
  }
  for (const svc of STATUS_PAGES.filter(s => s.type === 'healthcheck')) {
    try { await checkHealthService(svc); }
    catch (err) { console.log(`[${new Date().toISOString()}] ⚠️  ${svc.name}: ${err.message}`); }
    await sleep(500);
  }
  console.log(`[${new Date().toISOString()}] ✅ Status check complete. Issues: ${currentOutages.size}`);
}

// ── Keep-alive HTTP server ─────────────────────────────────────────────
function startServer() {
  require('http').createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status:          'running',
      version:         '6.0',
      uptime_mins:     Math.floor((Date.now() - botStartTime) / 60000),
      status_services: STATUS_PAGES.length,
      news_feeds:      NEWS_FEEDS.length,
      active_issues:   currentOutages.size,
      total_tweets:    totalTweets,
      last_status:     lastStatusCheck?.toISOString() || 'pending',
      last_news:       lastNewsCheck?.toISOString()   || 'pending',
      tweet_policy:    'outages, updates, recoveries, and official news only',
    }));
  }).listen(PORT, () => console.log(`[${new Date().toISOString()}] 🌐 Health server on port ${PORT}`));
}

// ── Self-ping ──────────────────────────────────────────────────────────
function startPing() {
  const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  setInterval(() => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, res => { res.resume(); console.log(`[${new Date().toISOString()}] 🏓 Ping OK`); })
       .on('error', e => console.log(`[${new Date().toISOString()}] 🏓 Ping: ${e.message}`));
  }, PING_EVERY);
}

// ── Boot ───────────────────────────────────────────────────────────────
async function boot() {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  AIStatusHub Bot v6.0`);
  console.log(`  Status: ${STATUS_PAGES.length} services monitored`);
  console.log(`  News:   ${NEWS_FEEDS.length} official feeds tracked`);
  console.log(`  Tweets: outages + recoveries + news only`);
  console.log(`${'═'.repeat(60)}\n`);

  startServer();

  // Seed status state silently
  console.log(`[${new Date().toISOString()}] 🌱 Seeding status state...`);
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
    } catch { /* ignore */ }
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
  console.log(`[${new Date().toISOString()}] ✅ Status seeded. Current issues: ${currentOutages.size}`);

  // Seed news feeds silently (mark existing articles as seen, don't tweet them)
  console.log(`[${new Date().toISOString()}] 🌱 Seeding news feeds...`);
  for (const feed of NEWS_FEEDS) {
    try {
      const xml   = await fetchText(feed.url);
      const items = parseRSS(xml);
      items.slice(0, 10).forEach(item => {
        seenNewsItems.add(item.link || item.title);
      });
      feed._seeded = true;
    } catch {
      feed._seeded = true;
    }
    await sleep(500);
  }
  console.log(`[${new Date().toISOString()}] ✅ News seeded. Known articles: ${seenNewsItems.size}`);

  startPing();

  // Start loops
  setInterval(checkAllStatus, CHECK_EVERY);
  setInterval(checkAllNews,   NEWS_CHECK_EVERY);
  setTimeout(checkAllStatus, 30  * 1000); // first status check after 30s
  setTimeout(checkAllNews,   60  * 1000); // first news check after 60s

  console.log(`[${new Date().toISOString()}] 🤖 Bot v6.0 live. Status every 5min, news every 30min.`);
}

process.on('uncaughtException',  e => console.error('[UNCAUGHT]', e.message));
process.on('unhandledRejection', e => console.error('[UNHANDLED]', e));

boot();
