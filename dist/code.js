figma.showUI(__html__, { themeColors: !0, height: 600, width: 450 });
figma.ui.onmessage = async (e) => {
  if (e.type === "get-available-layers") {
    const t = R();
    figma.ui.postMessage({
      type: "available-layers",
      layers: t
    });
  } else if (e.type === "fetch-wordpress-data")
    console.log("WordPress data fetch requested");
  else if (e.type === "populate-layers" && e.data)
    try {
      e.duplicateTemplate ? await v(
        e.data,
        e.layerMappings || {},
        e.templateSpacing || 50,
        e.gridLayout || !1,
        e.gridColumns || 1
      ) : await T(e.data, e.layerMappings || {}), figma.ui.postMessage({
        type: "notify",
        message: "Layers successfully populated!"
      });
    } catch (t) {
      figma.ui.postMessage({
        type: "notify",
        message: `Error populating layers: ${t.message}`
      });
    }
  else e.type === "notify" && figma.notify(e.message || "Operation completed");
};
async function v(e, t, i = 50, n = !1, o = 1) {
  if (await figma.loadFontAsync({ family: "Inter", style: "Regular" }), figma.currentPage.selection.length === 0) {
    figma.notify("Please select a node to use as template");
    return;
  }
  const a = figma.currentPage.selection[0], l = a.parent;
  if (!l) {
    figma.notify("Template node must have a parent");
    return;
  }
  let c = 0, r = 0;
  "width" in a && "height" in a && (c = a.width, r = a.height);
  let u = 0, d = 0;
  "x" in a && "y" in a && (u = a.x, d = a.y);
  const p = n ? o : 1, y = c + i, I = r + i;
  for (let f = 0; f < e.length; f++) {
    if (f === 0) {
      await h(a, e[f], t);
      continue;
    }
    let s = null;
    try {
      if ("clone" in a)
        s = a.clone();
      else {
        figma.notify(`Cannot clone node of type ${a.type}`);
        continue;
      }
      if (s && "appendChild" in l && l.appendChild(s), s && "x" in s && "y" in s)
        if (n) {
          const m = Math.floor(f / p), A = f % p;
          s.x = u + A * y, s.y = d + m * I;
        } else
          s.x = u, s.y = d + f * (r + i);
      s && await h(s, e[f], t);
    } catch (m) {
      figma.notify(`Error duplicating template: ${m.message}`);
    }
  }
  figma.notify(`Created and populated ${e.length} items`);
}
async function h(e, t, i) {
  for (const [o, a] of Object.entries(i)) {
    const l = L(e, a), c = P(t, o);
    if (c !== void 0)
      for (const r of l)
        await C(r, c, o);
  }
  const n = _(t);
  if (n) {
    const o = E(e);
    for (const a of o)
      await g(a, n);
  }
}
function L(e, t) {
  const i = [];
  if (e.name === t && i.push(e), "children" in e)
    for (const n of e.children)
      i.push(...L(n, t));
  return i;
}
function E(e) {
  const t = [], i = e.name.toLowerCase();
  if ((i.includes("image") || i.includes("img") || i.includes("photo") || i.includes("pic") || i.includes("thumbnail") || i.includes("featured")) && (e.type === "RECTANGLE" || e.type === "ELLIPSE" || e.type === "FRAME") && t.push(e), "children" in e)
    for (const n of e.children)
      t.push(...E(n));
  return t;
}
function R() {
  const e = [], t = figma.currentPage.selection, i = t.length > 0 ? t : [figma.currentPage];
  for (const n of i)
    w(n, e);
  return e;
}
function w(e, t) {
  if ("name" in e && e.type !== "DOCUMENT" && t.push({
    name: e.name,
    type: e.type,
    id: e.id
  }), "children" in e)
    for (const i of e.children)
      w(i, t);
}
function M(e) {
  return typeof e == "object" && (e != null && e.rendered) ? e.rendered : typeof e == "string" ? e : e == null ? "" : String(e);
}
function _(e) {
  var t, i, n, o, a, l, c;
  if (e._embedded && ((t = e._embedded["wp:featuredmedia"]) != null && t[0])) {
    const r = e._embedded["wp:featuredmedia"][0];
    if ((o = (n = (i = r.media_details) == null ? void 0 : i.sizes) == null ? void 0 : n.medium) != null && o.source_url)
      return r.media_details.sizes.medium.source_url;
    if ((c = (l = (a = r.media_details) == null ? void 0 : a.sizes) == null ? void 0 : l.full) != null && c.source_url)
      return r.media_details.sizes.full.source_url;
    if (r.source_url)
      return r.source_url;
  }
  return e.featured_image_url ? e.featured_image_url : null;
}
function P(e, t) {
  if (!t) return;
  const i = t.split(".");
  let n = e;
  for (const o of i) {
    if (n == null || typeof n != "object")
      return;
    n = n[o];
  }
  return n;
}
async function T(e, t) {
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  const i = figma.currentPage.selection, n = i.length > 0 ? i : [figma.currentPage];
  for (let o = 0; o < e.length; o++) {
    const a = e[o], l = n[Math.min(o, n.length - 1)];
    for (const [r, u] of Object.entries(t)) {
      const d = b(l, u), p = P(a, r);
      if (p !== void 0)
        for (const y of d)
          await C(y, p, r);
    }
    const c = _(a);
    if (c) {
      const r = N(l);
      for (const u of r)
        await g(u, c);
    }
  }
}
async function C(e, t, i) {
  if (e.type === "TEXT") {
    let n = "";
    typeof t == "object" && (t != null && t.rendered) ? n = t.rendered : n = M(t), typeof n == "string" && n.includes("<") && (n = n.replace(/<[^>]*>/g, "")), e.characters = n;
  } else (e.type === "RECTANGLE" || e.type === "ELLIPSE" || e.type === "FRAME") && (i.includes("image") || i.includes("media") || i.includes("featured")) && typeof t == "string" && await g(e, t);
}
async function g(e, t) {
  try {
    (e.type === "RECTANGLE" || e.type === "ELLIPSE" || e.type === "FRAME") && (figma.notify(`Attempting to load image from: ${t}`), figma.notify("Image loading will be handled in future iterations."));
  } catch (i) {
    figma.notify(`Failed to apply image: ${i.message}`);
  }
}
function N(e) {
  const t = [];
  if ("children" in e)
    for (const i of e.children) {
      const n = i.name.toLowerCase();
      (n.includes("image") || n.includes("img") || n.includes("photo") || n.includes("pic") || n.includes("thumbnail") || n.includes("featured")) && (i.type === "RECTANGLE" || i.type === "ELLIPSE" || i.type === "FRAME") && t.push(i), "children" in i && t.push(...N(i));
    }
  return t;
}
function b(e, t) {
  const i = [];
  if ("children" in e)
    for (const n of e.children)
      n.name === t && i.push(n), "children" in n && i.push(...b(n, t));
  return i;
}
