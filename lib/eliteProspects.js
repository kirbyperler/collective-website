// Reusable Elite Prospects retrieval module.
// Scrapes ONLY the exact public player-profile page the caller supplies —
// no API key, no private/authenticated endpoints, no headless browser,
// no retries or bypasses of access controls. One HTTP request per call.

const REQUEST_TIMEOUT_MS = 8000;
const MAX_RESPONSE_BYTES = 3 * 1024 * 1024;
const ALLOWED_HOSTS = ["eliteprospects.com", "www.eliteprospects.com"];

function makeError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function isIpAddressHost(host) {
  if (host.includes(":")) return true; // IPv6 literal (URL.hostname keeps brackets)
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

function parseEliteProspectsUrl(rawUrl) {
  let url;
  try {
    url = new URL(String(rawUrl || "").trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (isIpAddressHost(host)) return null;
  if (!ALLOWED_HOSTS.includes(host)) return null;
  const match = url.pathname.match(/^\/player\/(\d+)(?:\/[a-z0-9-]*)?\/?$/i);
  if (!match) return null;
  const playerId = Number(match[1]);
  if (!Number.isInteger(playerId) || playerId <= 0) return null;
  return { playerId, url: `https://${host}${url.pathname}` };
}

function isValidEliteProspectsUrl(rawUrl) {
  return parseEliteProspectsUrl(rawUrl) !== null;
}

function isChallengePage(html) {
  const sample = html.slice(0, 6000).toLowerCase();
  return (
    sample.includes("checking your browser") ||
    sample.includes("just a moment") ||
    sample.includes("cf-challenge") ||
    sample.includes("attention required") ||
    sample.includes("captcha") ||
    sample.includes("verify you are human")
  );
}

async function readBodyWithLimit(response, maxBytes) {
  if (!response.body || typeof response.body.getReader !== "function") {
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > maxBytes) throw makeError("RESPONSE_TOO_LARGE", "The response exceeded the allowed size.");
    return text;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let received = 0;
  let result = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel().catch(() => {});
      throw makeError("RESPONSE_TOO_LARGE", "The response exceeded the allowed size.");
    }
    result += decoder.decode(value, { stream: true });
  }
  result += decoder.decode();
  return result;
}

// Fetches the exact validated profile URL once. No redirects are followed —
// a redirect to any host (including the same one) is treated as denied
// rather than risking a second request or an off-host hop.
async function fetchProfileHtml(profileUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const contactEmail = process.env.SCRAPER_CONTACT_EMAIL || "no-contact-configured";
  try {
    const response = await fetch(profileUrl, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "User-Agent": `CollectiveHockeyBot/1.0 (+contact: ${contactEmail})`,
        "Accept": "text/html"
      }
    });

    if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) {
      throw makeError("ACCESS_DENIED", "The profile URL redirected; refusing to follow.");
    }
    if (response.status === 401 || response.status === 403) throw makeError("ACCESS_DENIED", "Elite Prospects denied access to this page.");
    if (response.status === 429) throw makeError("RATE_LIMITED", "Elite Prospects rate-limited this request.");
    if (response.status === 404) throw makeError("NOT_FOUND", "Elite Prospects player page was not found.");

    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("text/html")) throw makeError("UNEXPECTED_CONTENT", "Elite Prospects did not return an HTML page.");

    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_RESPONSE_BYTES) throw makeError("RESPONSE_TOO_LARGE", "The response exceeded the allowed size.");

    const html = await readBodyWithLimit(response, MAX_RESPONSE_BYTES);

    if (isChallengePage(html)) throw makeError("CHALLENGE_PAGE", "Elite Prospects returned a challenge/verification page.");
    if (!response.ok) throw makeError("ACCESS_DENIED", `Elite Prospects returned ${response.status}.`);

    return html;
  } catch (error) {
    if (error.code) throw error;
    if (error.name === "AbortError") throw makeError("TIMEOUT", "The request to Elite Prospects timed out.");
    throw makeError("NETWORK_ERROR", "Could not reach Elite Prospects.");
  } finally {
    clearTimeout(timeout);
  }
}

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const hadBirthday = now.getMonth() > dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() >= dob.getDate());
  if (!hadBirthday) age -= 1;
  return age;
}

function firstDefined(obj, keys) {
  if (!obj || typeof obj !== "object") return null;
  for (const key of keys) {
    if (obj[key] != null && obj[key] !== "") return obj[key];
  }
  return null;
}

function asString(value) {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") return value.name || value.title || value.slug || value.imperial || null;
  return null;
}

function normalizeBioObject(obj) {
  if (!obj) return null;
  const nameParts = [firstDefined(obj, ["firstName", "first_name"]), firstDefined(obj, ["lastName", "last_name"])].filter(Boolean).join(" ");
  const fullName = asString(firstDefined(obj, ["fullName", "name"])) || (nameParts || null);
  const dateOfBirth = asString(firstDefined(obj, ["dateOfBirth", "birthDate", "dob"]));
  let height = firstDefined(obj, ["height"]);
  height = height && typeof height === "object" ? (height.imperial || (typeof height.metrics === "number" ? `${height.metrics} cm` : null)) : asString(height);
  let weight = firstDefined(obj, ["weight"]);
  weight = weight && typeof weight === "object" ? (typeof weight.imperial === "number" ? `${weight.imperial} lbs` : (typeof weight.metrics === "number" ? `${weight.metrics} kg` : null)) : asString(weight);
  return {
    fullName: fullName || null,
    dateOfBirth: dateOfBirth || null,
    age: calculateAge(dateOfBirth),
    placeOfBirth: asString(firstDefined(obj, ["placeOfBirth", "birthPlace", "birthTown"])),
    nationality: asString(firstDefined(obj, ["nationality", "nation"])),
    position: asString(firstDefined(obj, ["position", "positionName"])),
    shoots: asString(firstDefined(obj, ["shoots", "shootsCatches", "catches"])),
    height: height || null,
    weight: weight || null
  };
}

function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) return Number(value);
  return null;
}

function extractYear(season) {
  if (season && typeof season === "object") {
    const y = Number(season.endYear ?? season.startYear);
    if (Number.isFinite(y)) return y;
  }
  const text = asString(season) || "";
  const matches = text.match(/\d{4}/g);
  return matches ? Number(matches[matches.length - 1]) : -Infinity;
}

function normalizeStatsRow(row) {
  const stats = row.regularStats || row.stats || row;
  return {
    season: asString(row.season) || null,
    team: asString(firstDefined(row, ["teamName", "team"])),
    league: asString(firstDefined(row, ["leagueName", "league"])),
    gp: toNumber(firstDefined(stats, ["GP", "gp", "gamesPlayed"])),
    goals: toNumber(firstDefined(stats, ["G", "goals"])),
    assists: toNumber(firstDefined(stats, ["A", "assists"])),
    points: toNumber(firstDefined(stats, ["PTS", "points"])),
    pim: toNumber(firstDefined(stats, ["PIM", "pim"])),
    plusMinus: toNumber(firstDefined(stats, ["PM", "plusMinus", "plusMinusRating"])),
    _sortYear: extractYear(row.season)
  };
}

const EMPTY_SEASON = { season: null, team: null, league: null, gp: null, goals: null, assists: null, points: null, pim: null, plusMinus: null };

function selectLatestSeason(rows) {
  if (!Array.isArray(rows) || !rows.length) return { ...EMPTY_SEASON };
  const normalized = rows.map(normalizeStatsRow);
  const sorted = [...normalized].sort((a, b) => b._sortYear - a._sortYear);
  const best = sorted.find(row => typeof row.gp === "number" && row.gp > 0) || sorted.find(row => row.gp != null || row.goals != null || row.points != null) || null;
  if (!best) return { ...EMPTY_SEASON };
  const { _sortYear, ...season } = best;
  return season;
}

// Recursively searches a parsed JSON tree for the first array whose items
// look like season-stat rows, and the first object that looks like a bio.
function deepFind(node, { wantArray, matchesArray, matchesObject }, depth = 0, seen = new Set()) {
  if (node == null || typeof node !== "object" || depth > 8 || seen.has(node)) return null;
  seen.add(node);

  if (Array.isArray(node)) {
    if (wantArray && node.length && node.every(item => item && typeof item === "object") && matchesArray(node)) return node;
    for (const item of node) {
      const found = deepFind(item, { wantArray, matchesArray, matchesObject }, depth + 1, seen);
      if (found) return found;
    }
    return null;
  }

  if (!wantArray && matchesObject(node)) return node;
  for (const value of Object.values(node)) {
    const found = deepFind(value, { wantArray, matchesArray, matchesObject }, depth + 1, seen);
    if (found) return found;
  }
  return null;
}

function looksLikeStatsRow(row) {
  const stats = row.regularStats || row.stats || row;
  return Boolean(row.season && (firstDefined(stats, ["GP", "gp", "gamesPlayed"]) != null));
}

function looksLikeBio(obj) {
  const hasName = firstDefined(obj, ["fullName", "name"]) != null || (obj.firstName && obj.lastName);
  const hasBioField = firstDefined(obj, ["dateOfBirth", "birthDate", "position", "positionName"]) != null;
  return Boolean(hasName && hasBioField);
}

function extractScriptJson(html, matchAttr) {
  const results = [];
  const scriptRegex = new RegExp(`<script[^>]*${matchAttr}[^>]*>([\\s\\S]*?)</script>`, "gi");
  let match;
  while ((match = scriptRegex.exec(html))) {
    try {
      results.push(JSON.parse(match[1]));
    } catch {
      // ignore malformed/unrelated script blocks
    }
  }
  return results;
}

function parseProfileHtml(html) {
  let bio = null;
  let statsRows = null;

  const nextDataBlocks = extractScriptJson(html, 'id=["\']__NEXT_DATA__["\']');
  for (const data of nextDataBlocks) {
    if (!bio) bio = deepFind(data, { wantArray: false, matchesObject: looksLikeBio });
    if (!statsRows) statsRows = deepFind(data, { wantArray: true, matchesArray: rows => rows.some(looksLikeStatsRow) });
    if (bio && statsRows) break;
  }

  if (!bio) {
    const ldBlocks = extractScriptJson(html, 'type=["\']application/ld\\+json["\']');
    for (const block of ldBlocks) {
      const items = Array.isArray(block) ? block : [block];
      const person = items.find(item => item && (item["@type"] === "Person" || item["@type"] === "Athlete"));
      if (person) {
        bio = {
          fullName: person.name,
          dateOfBirth: person.birthDate,
          placeOfBirth: person.birthPlace,
          nationality: person.nationality,
          height: person.height,
          weight: person.weight
        };
        break;
      }
    }
  }

  if (!bio && !statsRows) throw makeError("PARSE_FAILED", "Could not locate player data on the page.");

  return {
    bio: normalizeBioObject(bio),
    latestSeason: selectLatestSeason(statsRows)
  };
}

// Accepts only a validated Elite Prospects player-profile URL, fetches the
// public page once, and normalizes whatever structured data is embedded in
// it. Throws an Error with a short `.code` on any failure; never fabricates
// data and never retries a blocked/rate-limited/challenge response.
async function fetchEliteProspectsData(profileUrl) {
  const parsed = parseEliteProspectsUrl(profileUrl);
  if (!parsed) throw makeError("INVALID_URL", "The Elite Prospects URL is not a valid public player profile link.");

  const html = await fetchProfileHtml(parsed.url);
  const { bio, latestSeason } = parseProfileHtml(html);

  return {
    bio: bio || { fullName: null, dateOfBirth: null, age: null, placeOfBirth: null, nationality: null, position: null, shoots: null, height: null, weight: null },
    latestSeason,
    lastUpdated: new Date().toISOString()
  };
}

module.exports = { parseEliteProspectsUrl, isValidEliteProspectsUrl, fetchEliteProspectsData };
