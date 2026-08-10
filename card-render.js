/* ══════════════════════════════════════════════════════════════
   card-render.js — the dedication card, drawn to a canvas.

   One renderer, three users: the website's download button, the
   print sheet, and the WhatsApp poster. Keeping it in one file is
   the whole point — a card printed for a shtender and the card a
   sponsor downloads should be the same object, not two designs
   that drift apart over a month.

   Everything is expressed as a fraction of the canvas, so the same
   code draws a 1600x960 preview, a 1748x1240 print card at 300dpi,
   and a 1080x1350 poster.

   Two layouts share one visual language:
     landscape — text left, candle right. The website's card.
     portrait  — candle above, text centred. For phone screens.
   ══════════════════════════════════════════════════════════════ */
(function(global){
"use strict";

/* Straight from the site's :root. If these change there, change
   them here — they are the same design. */
var PALETTE = {
  night:      ["#0E1626", "#070C16", "#0B111E"],
  gold:       "#D6B26A",
  goldBright: "#F0D294",
  onNight2:   "#B9C4D4",
  onNight3:   "#7E8CA3",
  wax:        ["rgba(226,214,190,.9)", "#FFFDF6", "#FFF8E8", "rgba(206,192,166,.9)"],
  wick:       "#2A2118"
};

var FONT_DISPLAY = "'Cormorant Garamond', 'Iowan Old Style', Palatino, Georgia, serif";
var FONT_BODY    = "Inter, Helvetica, Arial, sans-serif";
var FONT_HEBREW  = "'Frank Ruhl Libre', 'Times New Roman', serif";

function roundRect(x, l, t, w, h, r){
  x.beginPath();
  x.moveTo(l + r, t);
  x.arcTo(l + w, t,     l + w, t + h, r);
  x.arcTo(l + w, t + h, l,     t + h, r);
  x.arcTo(l,     t + h, l,     t,     r);
  x.arcTo(l,     t,     l + w, t,     r);
  x.closePath();
}

/* Real letter-spacing. Canvas has no tracking property that's safe
   across browsers, so the glyphs are placed one at a time. */
function tracked(x, text, cx, y, spacing, align){
  var chars = String(text).split("");
  var total = 0, i;
  for(i = 0; i < chars.length; i++) total += x.measureText(chars[i]).width + spacing;
  total -= spacing;

  var start = align === "center" ? cx - total/2 : cx;
  for(i = 0; i < chars.length; i++){
    x.fillText(chars[i], start, y);
    start += x.measureText(chars[i]).width + spacing;
  }
  return total;
}

function trackedWidth(x, text, spacing){
  var chars = String(text).split(""), total = 0, i;
  for(i = 0; i < chars.length; i++) total += x.measureText(chars[i]).width + spacing;
  return total - spacing;
}

/* Tracked labels are the ones that overflow, because their width
   depends on a date or a family name we don't control. Shrink the
   type and the tracking together until the label fits its slot. */
function fitTracked(x, text, maxW, start, floor, family, weight, track){
  var size = start;
  for(;;){
    x.font = weight + " " + size + "px " + family;
    if(trackedWidth(x, text, size * track) <= maxW || size <= floor) break;
    size -= Math.max(0.5, start * 0.04);
  }
  return { size: size, spacing: size * track };
}

function wrapText(x, text, maxW){
  var words = String(text).split(/\s+/), lines = [], line = "";
  words.forEach(function(w){
    var test = line ? line + " " + w : w;
    if(x.measureText(test).width > maxW && line){ lines.push(line); line = w; }
    else line = test;
  });
  if(line) lines.push(line);
  return lines;
}

/* Shrink until it fits, but never past the floor — past that we
   wrap instead, because a name set too small stops reading as the
   subject of the card. */
function fitFont(x, text, maxW, start, floor, family, weight){
  var size = start;
  x.font = weight + " " + size + "px " + family;
  while(x.measureText(text).width > maxW && size > floor){
    size -= Math.max(1, Math.round(start * 0.045));
    x.font = weight + " " + size + "px " + family;
  }
  return size;
}

function ground(x, W, H){
  var bg = x.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0,   PALETTE.night[0]);
  bg.addColorStop(.55, PALETTE.night[1]);
  bg.addColorStop(1,   PALETTE.night[2]);
  x.fillStyle = bg;
  x.fillRect(0, 0, W, H);
}

function glow(x, cx, cy, r){
  var g = x.createRadialGradient(cx, cy, r * 0.02, cx, cy, r);
  g.addColorStop(0,   "rgba(255,190,110,.30)");
  g.addColorStop(.45, "rgba(255,150,70,.10)");
  g.addColorStop(1,   "rgba(255,150,70,0)");
  x.fillStyle = g;
  x.fillRect(cx - r, cy - r, r * 2, r * 2);
}

/* Hairline rule inset from the trim, with a heavier bracket at two
   opposite corners. */
function frame(x, W, H, inset, arm, weight){
  x.strokeStyle = "rgba(214,178,106,.42)";
  x.lineWidth = Math.max(1, weight * 0.5);
  roundRect(x, inset, inset, W - inset*2, H - inset*2, inset * 0.4);
  x.stroke();

  x.strokeStyle = "rgba(214,178,106,.9)";
  x.lineWidth = weight;
  x.beginPath();
  x.moveTo(inset, inset + arm); x.lineTo(inset, inset); x.lineTo(inset + arm, inset);
  x.stroke();
  x.beginPath();
  x.moveTo(W - inset, H - inset - arm); x.lineTo(W - inset, H - inset); x.lineTo(W - inset - arm, H - inset);
  x.stroke();
}

function candle(x, cx, top, w, h){
  var body = x.createLinearGradient(cx - w/2, 0, cx + w/2, 0);
  body.addColorStop(0,   PALETTE.wax[0]);
  body.addColorStop(.38, PALETTE.wax[1]);
  body.addColorStop(.62, PALETTE.wax[2]);
  body.addColorStop(1,   PALETTE.wax[3]);
  x.fillStyle = body;
  roundRect(x, cx - w/2, top, w, h, w * 0.1);
  x.fill();

  /* Specular stripe — this is what makes it read as a cylinder. */
  var spec = x.createLinearGradient(cx - w*0.30, 0, cx - w*0.06, 0);
  spec.addColorStop(0,   "rgba(255,255,255,0)");
  spec.addColorStop(.55, "rgba(255,255,255,.55)");
  spec.addColorStop(1,   "rgba(255,255,255,0)");
  x.fillStyle = spec;
  roundRect(x, cx - w*0.30, top + w*0.1, w*0.24, h - w*0.2, w*0.08);
  x.fill();

  /* Melted rim catching the flame. */
  var rim = x.createLinearGradient(0, top, 0, top + h * 0.06);
  rim.addColorStop(0, "rgba(255,214,150,.85)");
  rim.addColorStop(1, "rgba(255,214,150,0)");
  x.fillStyle = rim;
  roundRect(x, cx - w/2, top, w, h * 0.06, w * 0.1);
  x.fill();

  var wickH = w * 0.24, wickW = Math.max(1, w * 0.05);
  x.fillStyle = PALETTE.wick;
  roundRect(x, cx - wickW/2, top - wickH, wickW, wickH, wickW/2);
  x.fill();

  /* Flame: an ellipse drawn hot-centre-out, then a soft bloom over
     the top of the wax. */
  var fh = w * 0.86, fw = w * 0.40, fy = top - wickH - fh * 0.52;
  var fg = x.createRadialGradient(cx, fy + fh*0.28, 0, cx, fy + fh*0.1, fh*0.62);
  fg.addColorStop(0,   "#FFFFFF");
  fg.addColorStop(.22, "#FFF0C0");
  fg.addColorStop(.42, "#FFD98A");
  fg.addColorStop(.68, "#FF9E42");
  fg.addColorStop(.92, "rgba(232,106,44,.35)");
  fg.addColorStop(1,   "rgba(232,106,44,0)");
  x.fillStyle = fg;
  x.beginPath();
  x.ellipse(cx, fy, fw/2, fh/2, 0, 0, Math.PI * 2);
  x.fill();
}

/* ── landscape: the website's card ───────────────────────────── */
function drawLandscape(x, o){
  var W = o.W, H = o.H;
  var L = W * 0.07375, textW = W * 0.60;

  ground(x, W, H);
  glow(x, W * 0.79, H * 0.30, W * 0.2875);
  frame(x, W, H, W * 0.0275, W * 0.04125, Math.max(2, W * 0.0025));

  x.textAlign = "left";
  x.textBaseline = "alphabetic";

  /* masthead: programme left, slot right, on one line */
  var mastY = H * 0.175;
  x.fillStyle = PALETTE.gold;
  x.font = "600 " + (H * 0.02292) + "px " + FONT_BODY;
  var kickW = tracked(x, o.kicker, L, mastY, H * 0.0088, "left");

  if(o.slot){
    /* Whatever room the programme line leaves, minus a gap wide
       enough that the two never read as one string. */
    var room = W - L*2 - kickW - W * 0.05;
    var slot = String(o.slot).toUpperCase();
    var f = fitTracked(x, slot, room, H * 0.0215, H * 0.011,
                       FONT_BODY, "500", 0.34);
    x.fillStyle = PALETTE.goldBright;
    x.globalAlpha = .8;
    tracked(x, slot, W - L - trackedWidth(x, slot, f.spacing), mastY, f.spacing, "left");
    x.globalAlpha = 1;
  }

  /* The dedication is measured first and centred in the band between
     masthead and footer. The original card was drawn for one fixed
     shape; the same fractions on a squarer A6 leave a hole under the
     text, so the block is placed rather than pinned. */
  var hebLine = o.heb ? (o.hebLead ? o.hebLead + " " : "") + o.heb : "";
  var leadSize = H * 0.035417;
  var footY = H * 0.8667;

  x.font = "500 " + leadSize + "px " + FONT_DISPLAY;
  var nameSize = fitFont(x, o.name, textW, H * 0.0875, H * 0.04375, FONT_DISPLAY, "500");
  var lines = wrapText(x, o.name, textW).slice(0, 3);
  var hebSize = hebLine ? H * 0.054167 : 0;

  var blockH = leadSize + H * 0.030
             + lines.length * nameSize * 1.12
             + (hebLine ? hebSize * 1.30 : 0);

  var bandTop = mastY + H * 0.075, bandBottom = footY - H * 0.055;
  var y = bandTop + (bandBottom - bandTop - blockH) / 2 + leadSize;
  if(y < bandTop + leadSize) y = bandTop + leadSize;

  /* lead — set the font again here: fitFont above left the canvas on
     the name's size, which varies with how long the name is. */
  x.fillStyle = PALETTE.onNight2;
  x.font = "500 " + leadSize + "px " + FONT_DISPLAY;
  tracked(x, String(o.lead).toUpperCase(), L, y, H * 0.0021, "left");
  y += H * 0.030 + nameSize;

  /* name */
  x.fillStyle = "#FFFFFF";
  x.font = "500 " + nameSize + "px " + FONT_DISPLAY;
  lines.forEach(function(ln){ x.fillText(ln, L, y); y += nameSize * 1.12; });

  /* hebrew */
  if(hebLine){
    x.fillStyle = PALETTE.goldBright;
    x.font = "500 " + hebSize + "px " + FONT_HEBREW;
    x.direction = "rtl";
    x.fillText(hebLine, L, y + hebSize * 0.42);
    x.direction = "ltr";
  }

  /* footer */
  if(o.footer){
    var ff = fitTracked(x, String(o.footer).toUpperCase(), textW,
                        H * 0.025, H * 0.014, FONT_BODY, "500", 0.22);
    x.fillStyle = PALETTE.onNight3;
    tracked(x, String(o.footer).toUpperCase(), L, footY, ff.spacing, "left");
  }

  candle(x, W * 0.79, H * 0.26, W * 0.0475, H * 0.5625);
}

/* ── landscape: ink-saver print card ───────────────────────── */
function drawLandscapeLight(x, o){
  var W = o.W, H = o.H;
  var L = W * 0.07375, textW = W * 0.80;

  x.fillStyle = "#FFFFFF";
  x.fillRect(0, 0, W, H);

  var inset = W * 0.0275, arm = W * 0.04125;
  x.strokeStyle = "rgba(166,124,46,.48)";
  x.lineWidth = Math.max(1, W * 0.0018);
  roundRect(x, inset, inset, W - inset*2, H - inset*2, inset * 0.4);
  x.stroke();

  x.strokeStyle = "#A67C2E";
  x.lineWidth = Math.max(2, W * 0.0024);
  x.beginPath();
  x.moveTo(inset, inset + arm); x.lineTo(inset, inset); x.lineTo(inset + arm, inset);
  x.stroke();
  x.beginPath();
  x.moveTo(W - inset, H - inset - arm); x.lineTo(W - inset, H - inset); x.lineTo(W - inset - arm, H - inset);
  x.stroke();

  x.textAlign = "left";
  x.textBaseline = "alphabetic";

  var mastY = H * 0.175;
  x.fillStyle = "#A67C2E";
  x.font = "700 " + (H * 0.02292) + "px " + FONT_BODY;
  var kickW = tracked(x, o.kicker, L, mastY, H * 0.0088, "left");

  if(o.slot){
    var room = W - L*2 - kickW - W * 0.05;
    var slot = String(o.slot).toUpperCase();
    var f = fitTracked(x, slot, room, H * 0.0215, H * 0.011,
                       FONT_BODY, "600", 0.34);
    x.fillStyle = "#4A5565";
    tracked(x, slot, W - L - trackedWidth(x, slot, f.spacing), mastY, f.spacing, "left");
  }

  var hebLine = o.heb ? (o.hebLead ? o.hebLead + " " : "") + o.heb : "";
  var leadSize = H * 0.035417;
  var footY = H * 0.8667;

  x.font = "500 " + leadSize + "px " + FONT_DISPLAY;
  var nameSize = fitFont(x, o.name, textW, H * 0.0875, H * 0.04375, FONT_DISPLAY, "600");
  var lines = wrapText(x, o.name, textW).slice(0, 3);
  var hebSize = hebLine ? H * 0.054167 : 0;

  var blockH = leadSize + H * 0.030
             + lines.length * nameSize * 1.12
             + (hebLine ? hebSize * 1.30 : 0);

  var bandTop = mastY + H * 0.075, bandBottom = footY - H * 0.055;
  var y = bandTop + (bandBottom - bandTop - blockH) / 2 + leadSize;
  if(y < bandTop + leadSize) y = bandTop + leadSize;

  x.fillStyle = "#4A5565";
  x.font = "600 " + leadSize + "px " + FONT_DISPLAY;
  tracked(x, String(o.lead).toUpperCase(), L, y, H * 0.0021, "left");
  y += H * 0.030 + nameSize;

  x.fillStyle = "#111827";
  x.font = "600 " + nameSize + "px " + FONT_DISPLAY;
  lines.forEach(function(ln){ x.fillText(ln, L, y); y += nameSize * 1.12; });

  if(hebLine){
    x.fillStyle = "#A67C2E";
    x.font = "600 " + hebSize + "px " + FONT_HEBREW;
    x.direction = "rtl";
    x.fillText(hebLine, L, y + hebSize * 0.42);
    x.direction = "ltr";
  }

  if(o.footer){
    var ff = fitTracked(x, String(o.footer).toUpperCase(), textW,
                        H * 0.025, H * 0.014, FONT_BODY, "600", 0.22);
    x.fillStyle = "#4A5565";
    tracked(x, String(o.footer).toUpperCase(), L, footY, ff.spacing, "left");
  }
}

/* ── portrait: the poster ────────────────────────────────────── */
function drawPortrait(x, o){
  var W = o.W, H = o.H;
  var cx = W / 2, textW = W * 0.80;

  ground(x, W, H);
  glow(x, cx, H * 0.20, W * 0.62);
  frame(x, W, H, W * 0.045, W * 0.07, Math.max(2, W * 0.004));

  /* The candle carries the top third on its own. */
  candle(x, cx, H * 0.115, W * 0.055, H * 0.175);

  x.textAlign = "left";
  x.textBaseline = "alphabetic";

  var hebLine = o.heb ? (o.hebLead ? o.hebLead + " " : "") + o.heb : "";

  /* Measure the whole dedication before drawing any of it, so the
     block can be centred in the band between the candle and the
     foot. Names run from two words to ten; a fixed start leaves a
     hole under the short ones. */
  var kickSize = H * 0.0165;
  var leadSize = H * 0.0265;
  x.font = "500 " + leadSize + "px " + FONT_DISPLAY;

  var nameSize = fitFont(x, o.name, textW, H * 0.062, H * 0.032, FONT_DISPLAY, "500");
  var nameLines = wrapText(x, o.name, textW).slice(0, 3);

  var hebSize = 0;
  if(hebLine) hebSize = fitFont(x, hebLine, textW, H * 0.040, H * 0.024, FONT_HEBREW, "500");

  var blockH = kickSize + H * 0.045          /* masthead + gap  */
             + leadSize + H * 0.030          /* lead + gap      */
             + nameLines.length * nameSize * 1.14
             + (hebLine ? hebSize * 1.75 : 0);

  var bandTop = H * 0.34, bandBottom = H * 0.845;
  var y = bandTop + (bandBottom - bandTop - blockH) / 2 + kickSize;
  if(y < bandTop + kickSize) y = bandTop + kickSize;

  /* masthead, centred */
  x.fillStyle = PALETTE.gold;
  x.font = "600 " + kickSize + "px " + FONT_BODY;
  tracked(x, o.kicker, cx, y, H * 0.0072, "center");
  y += H * 0.045;

  /* lead */
  x.fillStyle = PALETTE.onNight2;
  x.font = "500 " + leadSize + "px " + FONT_DISPLAY;
  tracked(x, String(o.lead).toUpperCase(), cx, y, H * 0.0018, "center");
  y += H * 0.030 + nameSize;

  /* name */
  x.fillStyle = "#FFFFFF";
  x.textAlign = "center";
  x.font = "500 " + nameSize + "px " + FONT_DISPLAY;
  nameLines.forEach(function(ln){ x.fillText(ln, cx, y); y += nameSize * 1.14; });

  /* hebrew */
  if(hebLine){
    x.fillStyle = PALETTE.goldBright;
    x.font = "500 " + hebSize + "px " + FONT_HEBREW;
    x.direction = "rtl";
    x.fillText(hebLine, cx, y + hebSize * 0.62);
    x.direction = "ltr";
  }

  x.textAlign = "left";

  /* Slot and sponsor at the foot, fitted so a long weekday-and-date
     never runs into the frame. */
  var inner = W - W * 0.045 * 2 - W * 0.06;
  if(o.slot){
    var fs = fitTracked(x, String(o.slot).toUpperCase(), inner,
                        H * 0.0175, H * 0.009, FONT_BODY, "500", 0.39);
    x.fillStyle = PALETTE.goldBright;
    x.globalAlpha = .8;
    tracked(x, String(o.slot).toUpperCase(), cx, H * 0.895, fs.spacing, "center");
    x.globalAlpha = 1;
  }
  if(o.footer){
    var ff = fitTracked(x, String(o.footer).toUpperCase(), inner,
                        H * 0.0155, H * 0.008, FONT_BODY, "500", 0.31);
    x.fillStyle = PALETTE.onNight3;
    tracked(x, String(o.footer).toUpperCase(), cx, H * 0.935, ff.spacing, "center");
  }
}

global.CARD = {
  PALETTE: PALETTE,

  /* o: { W, H, layout, kicker, slot, lead, name, hebLead, heb, footer } */
  draw: function(ctx, o){
    ctx.save();
    if(o.layout === "portrait") drawPortrait(ctx, o);
    else if(o.theme === "light") drawLandscapeLight(ctx, o);
    else drawLandscape(ctx, o);
    ctx.restore();
  },

  /* Convenience: a detached canvas with the card already on it. */
  toCanvas: function(o){
    var c = document.createElement("canvas");
    c.width = o.W; c.height = o.H;
    this.draw(c.getContext("2d"), o);
    return c;
  }
};

})(window);
