/* ══════════════════════════════════════════════════════════════
   daily-poster-email.gs — paste this into the Apps Script behind
   the sponsorship sheet, then add a time-driven trigger for
   dailyPosterEmail at about 6am.

   Apps Script cannot draw the poster: there is no canvas on the
   server. So it doesn't try. The GitHub Action renders the real
   poster from poster.html at 05:10 and commits it; this fetches
   that file and attaches it. You get a genuine PNG in your inbox,
   drawn by the same code as the website.

   Both halves are needed. If the Action hasn't run, this sends the
   dedication list and says the image is missing rather than
   pretending it's there.
   ══════════════════════════════════════════════════════════════ */

var POSTER_BASE       = "https://raw.githubusercontent.com/dgscodes/yc-elul-learning/main/daily/";
var POSTER_MAIL_TO    = "dodosimon18@gmail.com, levisimon18@icloud.com";
var POSTER_SHEET_NAME = "Sponsorships";
var POSTER_ELUL_START = new Date(2026, 7, 14);   /* 1 Elul 5786 = 14 Aug 2026 */
var POSTER_ELUL_DAYS  = 29;

function dailyPosterEmail(){
  var n = posterElulDayToday();
  if(n < 1 || n > POSTER_ELUL_DAYS) return;        /* outside Elul, stay quiet */

  var todays = rowsForDay(n);
  if(!todays.length) return;                /* nothing booked, no mail */

  var lines = todays.map(function(r){
    return "• " + r.type + " " + r.name + "  (" + r.seder + ")";
  }).join("\n");

  var posters = fetchPosters();
  var body = "Today's learning — " + n + " Elul\n\n" + lines + "\n\n";

  body += posters.length
    ? "The poster is attached. Open it on your phone and forward it to WhatsApp."
    : "The poster image isn't ready yet — check the Daily poster action on GitHub. "
      + "You can still open it directly:\n"
      + "https://yclearning.co.za/poster.html?day=" + n;

  MailApp.sendEmail({
    to: POSTER_MAIL_TO,
    subject: "Today's learning — " + n + " Elul",
    body: body,
    attachments: posters
  });
}

function posterElulDayToday(){
  var t = new Date(); t.setHours(0,0,0,0);
  var s = new Date(POSTER_ELUL_START); s.setHours(0,0,0,0);
  return Math.round((t - s) / 86400000) + 1;
}

/* Reads by header name rather than column letter, so inserting a
   column in the sheet doesn't quietly break the email. */
function rowsForDay(n){
  var sheet = SpreadsheetApp.getActive().getSheetByName(POSTER_SHEET_NAME);
  if(!sheet) return [];

  var values = sheet.getDataRange().getValues();
  if(values.length < 2) return [];

  var head = values.shift().map(function(h){ return String(h).trim().toLowerCase(); });
  var at = function(name){ return head.indexOf(name); };

  var iDay = at("elul day"), iName = at("name"),
      iType = at("dedication type"), iSeder = at("seder");
  if(iDay < 0 || iName < 0) return [];

  return values.filter(function(r){
    return Number(r[iDay]) === n && String(r[iName]).trim() !== "";
  }).map(function(r){
    return {
      name:  String(r[iName]).trim(),
      type:  iType  > -1 ? String(r[iType]).trim()  : "",
      seder: iSeder > -1 ? String(r[iSeder]).trim() : ""
    };
  });
}

/* raw.githubusercontent caches for a few minutes, which is long
   enough to serve yesterday's picture. The timestamp defeats it. */
function fetchPosters(){
  var bust = "?t=" + Date.now();
  var index;
  try {
    var res = UrlFetchApp.fetch(POSTER_BASE + "today.json" + bust,
                                { muteHttpExceptions: true });
    if(res.getResponseCode() !== 200) return [];
    index = JSON.parse(res.getContentText());
  } catch(err){
    return [];
  }

  if(!index || Number(index.day) !== posterElulDayToday()) return [];   /* stale */

  var out = [];
  (index.files || []).forEach(function(f){
    try {
      var r = UrlFetchApp.fetch(POSTER_BASE + f + bust, { muteHttpExceptions: true });
      if(r.getResponseCode() === 200) out.push(r.getBlob().setName(f));
    } catch(err){ /* skip the one that failed, send the rest */ }
  });
  return out;
}
