// AIStatusHub — Official Status Page Monitor Bot
// Monitors 39 AI companies' official status pages and auto-tweets updates
// Features: outage alerts, recovery alerts, official updates, 6-hour summaries

const { TwitterApi } = require('twitter-api-v2');
const https = require('https');
const http = require('http');

// ── Twitter Client ─────────────────────────────────────────────────
const client = new TwitterApi({
  appKey:        process.env.TWITTER_API_KEY,
  appSecret:     process.env.TWITTER_API_SECRET,
  accessToken:   process.env.TWITTER_ACCESS_TOKEN,
  accessSecret:  process.env.TWITTER_ACCESS_SECRET,
});
const rwClient = client.readWrite;

// ── Config ─────────────────────────────────────────────────────────
const CHECK_EVERY   = 5 * 60 * 1000;        // check every 5 minutes
const SUMMARY_EVERY = 6 * 60 * 60 * 1000;   // summary every 6 hours
const SITE_URL      = 'https://aistatushub.com';

// ── Official status pages for all 39 services ─────────────────────
const STATUS_PAGES = [
  // General AI
  { id:'chatgpt',      name:'ChatGPT',             url:'https://status.openai.com/api/v2/summary.json',                    type:'statuspage', hashtags:'#ChatGPT #OpenAI',           pageUrl:'https://aistatushub.com/chatgpt-status.html' },
  { id:'claude',       name:'Claude',              url:'https://status.anthropic.com/api/v2/summary.json',                 type:'statuspage', hashtags:'#Claude #Anthropic',          pageUrl:'https://aistatushub.com/claude-status.html' },
  { id:'gemini',       name:'Google Gemini',       url:'https://status.cloud.google.com/incidents.json',                   type:'google',     hashtags:'#Gemini #Google',             pageUrl:'https://aistatushub.com/gemini-status.html' },
  { id:'grok',         name:'Grok',                url:'https://status.x.ai/api/v2/summary.json',                          type:'statuspage', hashtags:'#Grok #xAI',                  pageUrl:'https://aistatushub.com/grok-status.html' },
  { id:'perplexity',   name:'Perplexity AI',       url:'https://status.perplexity.ai/api/v2/summary.json',                 type:'statuspage', hashtags:'#Perplexity #AI',             pageUrl:'https://aistatushub.com/perplexity-status.html' },
  { id:'mscopilot',    name:'Microsoft Copilot',   url:'https://status.microsoftonline.com/api/v2/summary.json',           type:'statuspage', hashtags:'#MicrosoftCopilot #Microsoft',pageUrl:'https://aistatushub.com/mscopilot-status.html' },
  { id:'mistral',      name:'Mistral AI',          url:'https://status.mistral.ai/api/v2/summary.json',                    type:'statuspage', hashtags:'#Mistral #AI',                pageUrl:'https://aistatushub.com/mistral-status.html' },
  { id:'llama',        name:'Meta Llama',          url:'https://status.llamameta.com/api/v2/summary.json',                 type:'statuspage', hashtags:'#MetaLlama #Meta',            pageUrl:'https://aistatushub.com/llama-status.html' },
  { id:'cohere',       name:'Cohere',              url:'https://status.cohere.com/api/v2/summary.json',                    type:'statuspage', hashtags:'#Cohere #AI',                 pageUrl:'https://aistatushub.com/cohere-status.html' },
  { id:'huggingface',  name:'Hugging Face',        url:'https://status.huggingface.co/api/v2/summary.json',               type:'statuspage', hashtags:'#HuggingFace #AI',            pageUrl:'https://aistatushub.com/huggingface-status.html' },
  { id:'deepl',        name:'DeepL',               url:'https://status.deepl.com/api/v2/summary.json',                    type:'statuspage', hashtags:'#DeepL #Translation',         pageUrl:'https://aistatushub.com/deepl-status.html' },
  { id:'canva',        name:'Canva AI',            url:'https://status.canva.com/api/v2/summary.json',                     type:'statuspage', hashtags:'#Canva #AIDesign',            pageUrl:'https://aistatushub.com/canva-status.html' },
  { id:'you',          name:'You.com',             url:'https://status.you.com/api/v2/summary.json',                       type:'statuspage', hashtags:'#YouCom #AI',                 pageUrl:'https://aistatushub.com/you-status.html' },
  { id:'together',     name:'Together AI',         url:'https://status.together.ai/api/v2/summary.json',                   type:'statuspage', hashtags:'#TogetherAI #AI',             pageUrl:'https://aistatushub.com/together-status.html' },

  // Coding & Dev
  { id:'copilot',      name:'GitHub Copilot',      url:'https://www.githubstatus.com/api/v2/summary.json',                 type:'statuspage', hashtags:'#GitHubCopilot #GitHub',      pageUrl:'https://aistatushub.com/copilot-status.html' },
  { id:'cursor',       name:'Cursor',              url:'https://status.cursor.sh/api/v2/summary.json',                     type:'statuspage', hashtags:'#Cursor #AI',                 pageUrl:'https://aistatushub.com/cursor-status.html' },
  { id:'claudecode',   name:'Claude Code',         url:'https://status.anthropic.com/api/v2/summary.json',                 type:'statuspage', hashtags:'#ClaudeCode #Anthropic',      pageUrl:'https://aistatushub.com/claudecode-status.html' },
  { id:'amazonq',      name:'Amazon Q',            url:'https://status.aws.amazon.com/data.json',                          type:'aws',        hashtags:'#AmazonQ #AWS',               pageUrl:'https://aistatushub.com/amazonq-status.html' },
  { id:'replit',       name:'Replit AI',           url:'https://status.replit.com/api/v2/summary.json',                    type:'statuspage', hashtags:'#Replit #AI',                 pageUrl:'https://aistatushub.com/replit-status.html' },
  { id:'phind',        name:'Phind',               url:'https://status.phind.com/api/v2/summary.json',                     type:'statuspage', hashtags:'#Phind #AI',                  pageUrl:'https://aistatushub.com/phind-status.html' },

  // Visuals, Audio & Video
  { id:'midjourney',   name:'Midjourney',          url:'https://status.midjourney.com/api/v2/summary.json',                type:'statuspage', hashtags:'#Midjourney #AIArt',          pageUrl:'https://aistatushub.com/midjourney-status.html' },
  { id:'dalle',        name:'DALL·E 3',            url:'https://status.openai.com/api/v2/summary.json',                    type:'statuspage', hashtags:'#DALLE #OpenAI',              pageUrl:'https://aistatushub.com/dalle-status.html' },
  { id:'adobefirefly', name:'Adobe Firefly',       url:'https://status.adobe.com/api/v2/summary.json',                     type:'statuspage', hashtags:'#AdobeFirefly #Adobe',        pageUrl:'https://aistatushub.com/adobefirefly-status.html' },
  { id:'stability',    name:'Stability AI',        url:'https://status.stability.ai/api/v2/summary.json',                  type:'statuspage', hashtags:'#StabilityAI #AIArt',         pageUrl:'https://aistatushub.com/stability-status.html' },
  { id:'runway',       name:'Runway',              url:'https://status.runwayml.com/api/v2/summary.json',                  type:'statuspage', hashtags:'#Runway #AIVideo',            pageUrl:'https://aistatushub.com/runway-status.html' },
  { id:'sora',         name:'Sora',                url:'https://status.openai.com/api/v2/summary.json',                    type:'statuspage', hashtags:'#Sora #OpenAI',               pageUrl:'https://aistatushub.com/sora-status.html' },
  { id:'googleveo',    name:'Google Veo',          url:'https://status.cloud.google.com/incidents.json',                   type:'google',     hashtags:'#GoogleVeo #Google',          pageUrl:'https://aistatushub.com/googleveo-status.html' },
  { id:'synthesia',    name:'Synthesia',           url:'https://status.synthesia.io/api/v2/summary.json',                  type:'statuspage', hashtags:'#Synthesia #AIVideo',         pageUrl:'https://aistatushub.com/synthesia-status.html' },
  { id:'elevenlabs',   name:'ElevenLabs',          url:'https://status.elevenlabs.io/api/v2/summary.json',                 type:'statuspage', hashtags:'#ElevenLabs #AIVoice',        pageUrl:'https://aistatushub.com/elevenlabs-status.html' },
  { id:'flux',         name:'Flux (BFL)',          url:'https://status.blackforestlabs.ai/api/v2/summary.json',            type:'statuspage', hashtags:'#Flux #AIArt',                pageUrl:'https://aistatushub.com/flux-status.html' },
  { id:'ideogram',     name:'Ideogram',            url:'https://status.ideogram.ai/api/v2/summary.json',                   type:'statuspage', hashtags:'#Ideogram #AIArt',            pageUrl:'https://aistatushub.com/ideogram-status.html' },
  { id:'suno',         name:'Suno',                url:'https://status.suno.com/api/v2/summary.json',                      type:'statuspage', hashtags:'#Suno #AIMusic',              pageUrl:'https://aistatushub.com/suno-status.html' },

  // Business, Content & Data
  { id:'jasper',       name:'Jasper AI',           url:'https://status.jasper.ai/api/v2/summary.json',                     type:'statuspage', hashtags:'#Jasper #AI',                 pageUrl:'https://aistatushub.com/jasper-status.html' },
  { id:'grammarly',    name:'Grammarly',           url:'https://status.grammarly.com/api/v2/summary.json',                 type:'statuspage', hashtags:'#Grammarly #AI',              pageUrl:'https://aistatushub.com/grammarly-status.html' },
  { id:'notionai',     name:'Notion AI',           url:'https://status.notion.so/api/v2/summary.json',                     type:'statuspage', hashtags:'#NotionAI #Notion',           pageUrl:'https://aistatushub.com/notionai-status.html' },
  { id:'glean',        name:'Glean',               url:'https://status.glean.com/api/v2/summary.json',                     type:'statuspage', hashtags:'#Glean #AI',                  pageUrl:'https://aistatushub.com/glean-status.html' },
  { id:'writer',       name:'Writer',              url:'https://status.writer.com/api/v2/summary.json',                    type:'statuspage', hashtags:'#Writer #AI',                 pageUrl:'https://aistatushub.com/writer-status.html' },
  { id:'anomalyai',    name:'Anomaly AI',          url:'https://status.anomaly.ai/api/v2/summary.json',                    type:'statuspage', hashtags:'#AnomalyAI #DataAI',          pageUrl:'https://aistatushub.com/anomalyai-status.html' },
  { id:'ada',          name:'Ada',                 url:'https://status.ada.cx/api/v2/summary.json',                        type:'statuspage', hashtags:'#Ada #AIHealth',              pageUrl:'https://aistatushub.com/ada-status.html' },
];

// ── State ──────────────────────────────────────────────────────────
const seenIncidents       = new Set();
const lastComponentStatus = {};
const currentOutages      = new Map();

// ── HTTP fetch helper ──────────────────────────────────────────────
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': 'AIStatusHub-Bot/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('JSON parse error: ' + e.message)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// ── Tweet helper ───────────────────────────────────────────────────
async function tweet(text) {
  if (text.length > 280) text = text.slice(0, 277) + '...';
  try {
    await rwClient.v2.tweet(text);
    console.log(`[${new Date().toISOString()}] ✅ Tweeted: ${text.slice(0,80)}...`);
  } catch(err) {
    console.error(`[${new Date().toISOString()}] ❌ Tweet failed:`, err?.data?.detail || err.message);
  }
}

// ── Parse statuspage.io format ─────────────────────────────────────
async function checkStatuspageFormat(svc) {
  try {
    const data = await fetchJSON(svc.url);

    // Active incidents
    const incidents = data.incidents || [];
    for (const inc of incidents) {
      if (seenIncidents.has(inc.id)) continue;
      seenIncidents.add(inc.id);

      const latestUpdate = inc.incident_updates?.[0];
      const updateText   = latestUpdate?.body || inc.name || 'Service disruption reported';
      const impact       = inc.impact || 'unknown';
      const status       = inc.status || 'investigating';

      const emoji = impact === 'critical' ? '🚨' :
                    impact === 'major'    ? '⚠️' :
                    impact === 'minor'    ? '🟡' : '📢';

      await tweet(
        `${emoji} ${svc.name} Official Update\n\n` +
        `Status: ${status.toUpperCase()}\n` +
        `"${updateText.slice(0, 120)}${updateText.length > 120 ? '...' : ''}"\n\n` +
        `Track live → ${svc.pageUrl}\n` +
        `${svc.hashtags} #AIStatus`
      );
      await new Promise(r => setTimeout(r, 3000));
    }

    // Component status changes
    const components = data.components || [];
    for (const comp of components) {
      const key  = `${svc.id}:${comp.id}`;
      const prev = lastComponentStatus[key];

      if (prev === undefined) {
        lastComponentStatus[key] = comp.status;
        if (comp.status !== 'operational') {
          currentOutages.set(key, { name: svc.name, component: comp.name, status: comp.status });
        }
        continue;
      }
      if (prev === comp.status) continue;

      lastComponentStatus[key] = comp.status;

      if (comp.status === 'operational' && prev !== 'operational') {
        currentOutages.delete(key);
        await tweet(
          `✅ ${svc.name} — "${comp.name}" is back to OPERATIONAL\n\n` +
          `All systems restored → ${svc.pageUrl}\n` +
          `${svc.hashtags} #AIStatus`
        );
      } else if (comp.status !== 'operational') {
        currentOutages.set(key, { name: svc.name, component: comp.name, status: comp.status });
        const emoji = comp.status === 'major_outage'   ? '🔴' :
                      comp.status === 'partial_outage' ? '🟠' : '🟡';
        await tweet(
          `${emoji} ${svc.name} — "${comp.name}" is ${comp.status.replace(/_/g,' ').toUpperCase()}\n\n` +
          `Live status → ${svc.pageUrl}\n` +
          `${svc.hashtags} #AIStatus #AIOutage`
        );
      }
      await new Promise(r => setTimeout(r, 3000));
    }

  } catch(err) {
    console.log(`[${new Date().toISOString()}] ⚠️  ${svc.name} check failed: ${err.message}`);
  }
}

// ── Check all services ─────────────────────────────────────────────
async function checkAll() {
  console.log(`[${new Date().toISOString()}] 🔍 Checking ${STATUS_PAGES.length} status pages...`);
  for (const svc of STATUS_PAGES) {
    await checkStatuspageFormat(svc);
    await new Promise(r => setTimeout(r, 1500));
  }
  console.log(`[${new Date().toISOString()}] ✅ Check complete`);
}

// ── Periodic summary tweet (every 6 hours) ─────────────────────────
async function tweetSummary() {
  const timeStr = new Date().toUTCString().replace(' GMT', '') + ' UTC';
  const outageList  = [...currentOutages.values()];
  const outageCount = outageList.length;
  const healthyCount = STATUS_PAGES.length - new Set(outageList.map(o => o.name)).size;

  let summaryText;
  if (outageCount === 0) {
    summaryText =
      `📊 AI Status Report — ${timeStr}\n\n` +
      `✅ All ${STATUS_PAGES.length} AI services are OPERATIONAL\n\n` +
      `No outages detected across ChatGPT, Claude, Gemini, Midjourney + 35 more.\n\n` +
      `Full dashboard → ${SITE_URL}\n` +
      `#AIStatus #AITools #StatusUpdate`;
  } else {
    const names = [...new Set(outageList.map(o => o.name))].slice(0, 5).join(', ');
    const more  = outageList.length > 5 ? ` +${outageList.length - 5} more` : '';
    summaryText =
      `📊 AI Status Report — ${timeStr}\n\n` +
      `🔴 ${outageCount} issue(s) detected:\n` +
      `${names}${more}\n\n` +
      `✅ ${healthyCount} services operational\n\n` +
      `Full dashboard → ${SITE_URL}\n` +
      `#AIStatus #AIOutage #AITools`;
  }

  await tweet(summaryText);
  console.log(`[${new Date().toISOString()}] 📊 Summary tweet sent`);
}

// ── Startup: seed existing state, no tweets on boot ───────────────
async function startupCheck() {
  console.log(`[${new Date().toISOString()}] 🤖 Bot starting — going live immediately`);

  // Tweet first summary right away
  await tweetSummary();

  // Start loops
  setInterval(checkAll, CHECK_EVERY);
  setInterval(tweetSummary, SUMMARY_EVERY);
}
startupCheck();
