/**
 * Solar System Mind Map
 * 
 * A modern interactive knowledge graph visualization inspired by planetary orbits.
 * The central "sun" is the BIBFRAME Work entity, with satellite planetary nodes
 * orbiting around it representing all properties (title, contributors, subjects, classification,
 * manuscript notes/incipit, extent, carrier, item holdings, and admin metadata).
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  BookOpen, Package, User, Tag, Hash, FileText, 
  Building2, Layers, X, ZoomIn, ZoomOut,
  RotateCcw, Pause, Play, Orbit, Sparkles, Quote, Copy, Check,
  ExternalLink, Shield} from "lucide-react";

interface SolarSystemMindMapProps {
  workData: any;
  instanceData: any;
  theme?: {
    cardBg?: string;
    cardBorder?: string;
    accent?: string;
    accentDim?: string;
    text?: string;
    textMuted?: string;
    success?: string;
    warning?: string;
    danger?: string;
    secondary?: string;
  };
}

interface OrbitNode {
  id: string;
  label: string;
  sublabel: string;
  category: "core" | "intellectual" | "manuscript" | "holding" | "admin";
  icon: React.ReactNode;
  color: string;
  glowColor: string;
  orbitRadius: number;
  orbitSpeed: number; // seconds per revolution
  startAngle: number;
  size: number;
  rdfPredicate: string;
  fullValue?: string;
  authorityUri?: string;
  children?: OrbitChild[];
}

interface OrbitChild {
  id: string;
  label: string;
  sublabel?: string;
  color: string;
  uri?: string;
}

function getStr(val: any, fallback = ""): string {
  if (!val) return fallback;
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  if (Array.isArray(val)) {
    for (const item of val) {
      const s = getStr(item);
      if (s) return s;
    }
    return fallback;
  }
  if (typeof val === "object") {
    return val["rdfs:label"] || val["bf:mainTitle"] || val["mainTitle"] || val["value"] || val["rdf:value"] || val["label"] || fallback;
  }
  return fallback;
}

function getArr(val: any): any[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return [val];
}

const DEFAULT_THEME = {
  cardBg: "rgba(15,23,42,0.85)",
  cardBorder: "rgba(59,130,246,0.15)",
  accent: "#3b82f6",
  accentDim: "#60a5fa",
  text: "#f1f5f9",
  textMuted: "#94a3b8",
  success: "#34d399",
  warning: "#fbbf24",
  danger: "#f87171",
  secondary: "#1e40af",
};

export function SolarSystemMindMap({ workData = {}, instanceData = {}, theme }: SolarSystemMindMapProps) {
  const T = theme || DEFAULT_THEME;
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [copiedText, setCopiedText] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [elapsedTime, setElapsedTime] = useState(0);
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // Responsive sizing
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      if (!entries[0]) return;
      const { width, height } = entries[0].contentRect;
      setDimensions({ width: Math.max(400, width), height: Math.max(420, height) });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Animation loop
  useEffect(() => {
    const tick = (now: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = now;
      if (!isPaused) {
        const dt = (now - lastTimeRef.current) / 1000;
        setElapsedTime(prev => prev + dt * speedMultiplier);
      }
      lastTimeRef.current = now;
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isPaused, speedMultiplier]);

  // Extract Work Main Title
  const workTitleObj = workData["bf:title"] || workData.title;
  const workMainTitle = getStr(workTitleObj?.["bf:mainTitle"] || workTitleObj?.mainTitle || workTitleObj, "القبسات");
  const workUri = workData["@id"] || "http://example.org/records/al-qabasat-work";

  // Build Comprehensive Orbit Nodes from BIBFRAME Work and Instance Data
  const allOrbitNodes = useMemo<OrbitNode[]>(() => {
    const nodes: OrbitNode[] = [];
    const minDim = Math.min(dimensions.width, dimensions.height);
    const baseOrbit = Math.max(50, minDim * 0.13);

    // 1. TITLE NODE (Inner Orbit)
    const titleVal = getStr(workTitleObj?.["bf:mainTitle"] || workTitleObj?.mainTitle || workTitleObj, "القبسات");
    nodes.push({
      id: "title",
      label: "Title / العنوان",
      sublabel: titleVal.length > 22 ? titleVal.substring(0, 20) + "..." : titleVal,
      category: "core",
      icon: <BookOpen className="h-4 w-4" />,
      color: "#3b82f6",
      glowColor: "rgba(59,130,246,0.5)",
      orbitRadius: baseOrbit * 0.9,
      orbitSpeed: 32,
      startAngle: 15,
      size: 40,
      rdfPredicate: "bf:title -> bf:mainTitle",
      fullValue: titleVal,
      children: [
        { id: "title-m", label: titleVal, color: "#60a5fa" },
        ...(workTitleObj?.["bflc:nonSortNum"] ? [{ id: "title-ns", label: `Non-Sort: ${workTitleObj["bflc:nonSortNum"]}`, color: "#93c5fd" }] : [])
      ]
    });

    // 2. CREATOR / CONTRIBUTION
    const rawContribs = getArr(workData["bf:contribution"] || workData.contribution || []);
    const primaryAgent = rawContribs[0]?.["bf:agent"] || rawContribs[0]?.agent || {};
    const creatorName = getStr(primaryAgent["rdfs:label"] || primaryAgent.name || workData.creator, "الميرداماد، محمد باقر الحسيني");
    const creatorRole = getStr(rawContribs[0]?.["bf:role"]?.["rdfs:label"] || rawContribs[0]?.role, "مؤلف / Author");
    const creatorUri = primaryAgent["@id"] || workData.creatorUri || "http://id.loc.gov/authorities/names/n85043844";

    nodes.push({
      id: "creator",
      label: "Creator / المؤلف",
      sublabel: creatorName.length > 22 ? creatorName.substring(0, 20) + "..." : creatorName,
      category: "intellectual",
      icon: <User className="h-4 w-4" />,
      color: "#8b5cf6",
      glowColor: "rgba(139,92,246,0.5)",
      orbitRadius: baseOrbit * 1.35,
      orbitSpeed: 45,
      startAngle: 75,
      size: 42,
      rdfPredicate: "bf:contribution -> bf:agent",
      fullValue: `${creatorName} (${creatorRole})`,
      authorityUri: creatorUri,
      children: [
        { id: "c-role", label: creatorRole, color: "#c084fc" },
        { id: "c-dates", label: "توفي 1041 هـ", color: "#d8b4fe" },
        ...(creatorUri ? [{ id: "c-uri", label: "LOC Authority", color: "#a855f7", uri: creatorUri }] : [])
      ]
    });

    // 3. CLASSIFICATION & SHELFMARK
    const rawClass = workData["bf:classification"] || workData.classification || workData.classificationLcc || instanceData["bf:classification"] || instanceData.shelfMark;
    let callNo = "B753.D363 Q23 1650";
    if (typeof rawClass === "object" && rawClass) {
      const p = rawClass["bf:classificationPortion"] || rawClass.classificationPortion || "";
      const i = rawClass["bf:itemPortion"] || rawClass.itemPortion || "";
      if (p || i) callNo = [p, i].filter(Boolean).join(" ");
      else if (rawClass["rdfs:label"]) callNo = rawClass["rdfs:label"];
    } else if (typeof rawClass === "string") {
      callNo = rawClass;
    }

    nodes.push({
      id: "classification",
      label: "LCC / التصنيف",
      sublabel: callNo,
      category: "core",
      icon: <Hash className="h-4 w-4" />,
      color: "#f59e0b",
      glowColor: "rgba(245,158,11,0.5)",
      orbitRadius: baseOrbit * 1.75,
      orbitSpeed: 52,
      startAngle: 140,
      size: 38,
      rdfPredicate: "bf:classification -> bf:ClassificationLcc",
      fullValue: `Call Number: ${callNo} (Library of Congress Classification B753)`,
      children: [
        { id: "cl-lcc", label: callNo, color: "#fbbf24" },
        { id: "cl-ddc", label: "DDC 181.07", color: "#fcd34d" }
      ]
    });

    // 4. SUBJECTS (TOPICAL & LCSH)
    const rawSubjects = getArr(workData["bf:subject"] || workData.subject || []);
    const subjectItems = rawSubjects.slice(0, 4).map((s: any, idx: number) => {
      const label = getStr(s?.["rdfs:label"] || s?.label || s, `موضوع ${idx + 1}`);
      const uri = s?.["@id"] || "";
      return { id: `subj-${idx}`, label: label.length > 18 ? label.substring(0, 16) + "..." : label, color: "#34d399", uri };
    });
    if (subjectItems.length === 0) {
      subjectItems.push({ id: "subj-1", label: "الفلسفة الإسلامية", color: "#34d399", uri: "" });
      subjectItems.push({ id: "subj-2", label: "علم الكلام", color: "#6ee7b7", uri: "" });
      subjectItems.push({ id: "subj-3", label: "الحدوث الدهري", color: "#a7f3d0", uri: "" });
    }

    nodes.push({
      id: "subjects",
      label: "Subjects / الموضوعات",
      sublabel: `${subjectItems.length} رؤوس موضوعات`,
      category: "intellectual",
      icon: <Tag className="h-4 w-4" />,
      color: "#10b981",
      glowColor: "rgba(16,185,129,0.5)",
      orbitRadius: baseOrbit * 2.15,
      orbitSpeed: 64,
      startAngle: 210,
      size: 38,
      rdfPredicate: "bf:subject -> bf:Topic",
      fullValue: "الفلسفة الإسلامية -- علم الكلام -- الحدوث والقدم -- مخطوطات نادرة",
      children: subjectItems
    });

    // 5. PRIMARY INSTANCE (Major Planetary Body)
    const rawIdent = instanceData["bf:identifiedBy"] || instanceData.identifiedBy || instanceData.identifier || "b125923";
    const instIdStr = getStr(rawIdent, "b125923");
    nodes.push({
      id: "instance",
      label: "Instance / النسخة",
      sublabel: "مخطوطة أصلية 1061 هـ",
      category: "core",
      icon: <Package className="h-5 w-5" />,
      color: "#06b6d4",
      glowColor: "rgba(6,182,212,0.6)",
      orbitRadius: baseOrbit * 2.6,
      orbitSpeed: 78,
      startAngle: 270,
      size: 48,
      rdfPredicate: "bf:hasInstance -> bf:Instance",
      fullValue: `${instanceData["@id"] || "http://example.org/records/al-qabasat-instance"} [Record ID: ${instIdStr}]`,
      children: [
        { id: "inst-id", label: `ID: ${instIdStr}`, color: "#67e8f9" },
        { id: "inst-prov", label: "1061 هـ = [1650]", color: "#a5f3fc" },
        { id: "inst-type", label: "مخطوط أصلي", color: "#22d3ee" }
      ]
    });

    // 6. MANUSCRIPT NOTES & INCIPIT
    const rawNotes = getArr(workData["bf:note"] || workData.note || instanceData["bf:note"] || []);
    let incipitNote = "الحمد لله الواحد الاحد الصمد المصمود مهيمن كل وجود...";
    let explicitNote = "ولا تخلنا اللهم مع ذلك من عواطف رأفتك...";
    rawNotes.forEach((n: any) => {
      const s = getStr(n?.["rdfs:label"] || n);
      if (s.startsWith("أوله") || s.includes("الحمد لله")) incipitNote = s;
      if (s.startsWith("آخره") || s.includes("ولا تخلنا")) explicitNote = s;
    });

    nodes.push({
      id: "manuscript-notes",
      label: "Incipit & Notes / الأوائل",
      sublabel: "أوله: الحمد لله الواحد الأحد...",
      category: "manuscript",
      icon: <Quote className="h-4 w-4" />,
      color: "#eab308",
      glowColor: "rgba(234,179,8,0.5)",
      orbitRadius: baseOrbit * 3.0,
      orbitSpeed: 92,
      startAngle: 330,
      size: 38,
      rdfPredicate: "bf:note -> bf:Note (Incipit / Explicit)",
      fullValue: `أوله: ${incipitNote}\nآخره: ${explicitNote}`,
      children: [
        { id: "note-inc", label: "أول المخطوطة", color: "#fde047" },
        { id: "note-exp", label: "آخر المخطوطة", color: "#fef08a" },
        { id: "note-bib", label: "الذريعة ج17 ص32", color: "#facc15" }
      ]
    });

    // 7. PHYSICAL EXTENT & CARRIER
    const extentVal = getStr(instanceData["bf:extent"] || instanceData.extent, "344 ورقة (18 سطرًا)");
    const dimsVal = getStr(instanceData["bf:dimensions"] || instanceData.dimensions, "21 × 15 سم");
    nodes.push({
      id: "physical",
      label: "Extent & Form / الوصف المادي",
      sublabel: extentVal,
      category: "manuscript",
      icon: <Layers className="h-4 w-4" />,
      color: "#f43f5e",
      glowColor: "rgba(244,63,94,0.5)",
      orbitRadius: baseOrbit * 3.4,
      orbitSpeed: 105,
      startAngle: 45,
      size: 36,
      rdfPredicate: "bf:extent & bf:dimensions",
      fullValue: `${extentVal} -- المقاس: ${dimsVal} -- خط النستعليق على ورق شرقي`,
      children: [
        { id: "ext-pages", label: "344 ورقة", color: "#fb7185" },
        { id: "ext-lines", label: "18 سطرًا", color: "#fda4af" },
        { id: "ext-dims", label: dimsVal, color: "#fecdd3" },
        { id: "ext-scr", label: "خط النستعليق", color: "#f43f5e" }
      ]
    });

    // 8. HOLDINGS & ITEM (Outer Orbit)
    nodes.push({
      id: "holdings",
      label: "Holdings / المقتنى والمكان",
      sublabel: "العتبة العباسية (IQ-KaCCS)",
      category: "holding",
      icon: <Building2 className="h-4 w-4" />,
      color: "#ec4899",
      glowColor: "rgba(236,72,153,0.5)",
      orbitRadius: baseOrbit * 3.8,
      orbitSpeed: 120,
      startAngle: 110,
      size: 36,
      rdfPredicate: "bf:hasItem -> bf:Item",
      fullValue: "مكتبة ودار مخطوطات العتبة العباسية المقدسة (IQ-KaCCS) -- الباركود: b125923 -- سيرسي: a209527",
      children: [
        { id: "h-lib", label: "IQ-KaCCS", color: "#f472b6" },
        { id: "h-bar", label: "Barcode: b125923", color: "#fbcfe8" },
        { id: "h-stat", label: "متاح للمطالعة", color: "#db2777" }
      ]
    });

    // 9. ADMINISTRATIVE METADATA (Distant Orbit)
    nodes.push({
      id: "admin",
      label: "Admin / بيانات الفهرسة",
      sublabel: "RDA / IQ-KaCCS / 008",
      category: "admin",
      icon: <Shield className="h-4 w-4" />,
      color: "#64748b",
      glowColor: "rgba(100,116,139,0.5)",
      orbitRadius: baseOrbit * 4.2,
      orbitSpeed: 140,
      startAngle: 185,
      size: 34,
      rdfPredicate: "bf:adminMetadata -> bf:AdminMetadata",
      fullValue: "فهرسة مقننة بمعايير RDA ومكتبة الكونغرس -- رمز المفهرس: IQ-KaCCS -- التاريخ: 120203",
      children: [
        { id: "adm-org", label: "Org: IQ-KaCCS", color: "#94a3b8" },
        { id: "adm-rul", label: "Rules: RDA", color: "#cbd5e1" },
        { id: "adm-mod", label: "008: 1650 xx ara", color: "#64748b" }
      ]
    });

    return nodes;
  }, [workData, instanceData, dimensions, workTitleObj]);

  // Filter nodes based on category
  const orbitNodes = useMemo(() => {
    if (filterCategory === "all") return allOrbitNodes;
    return allOrbitNodes.filter(n => n.category === filterCategory || n.category === "core");
  }, [allOrbitNodes, filterCategory]);

  // Center coordinate
  const cx = dimensions.width / 2;
  const cy = dimensions.height / 2;

  // Calculate position of a node on elliptical orbit
  const getNodePosition = (node: OrbitNode) => {
    const angleDeg = (node.startAngle + (elapsedTime / node.orbitSpeed) * 360) % 360;
    const angleRad = (angleDeg * Math.PI) / 180;
    const r = node.orbitRadius * zoom;
    return {
      x: cx + r * Math.cos(angleRad),
      y: cy + r * 0.65 * Math.sin(angleRad),
      angle: angleDeg,
    };
  };

  const selectedData = useMemo(() => {
    if (!selectedNode || selectedNode === "sun") return null;
    return allOrbitNodes.find(n => n.id === selectedNode) || null;
  }, [selectedNode, allOrbitNodes]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[620px] rounded-2xl overflow-hidden select-none border"
      style={{
        background: "radial-gradient(ellipse at center, #0f172a 0%, #030712 100%)",
        borderColor: T.cardBorder || "rgba(59,130,246,0.15)",
      }}
    >
      {/* Background Starfield & Celestial Grid */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40">
        <defs>
          <pattern id="celestialGrid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(148,163,184,0.05)" strokeWidth="1" />
            <circle cx="30" cy="30" r="0.75" fill="rgba(255,255,255,0.25)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#celestialGrid)" />
      </svg>

      {/* Orbit Rings SVG */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 2 }}>
        {orbitNodes.map(node => {
          const rx = node.orbitRadius * zoom;
          const ry = rx * 0.65;
          const isHighlighted = hoveredNode === node.id || selectedNode === node.id;
          return (
            <ellipse
              key={`orbit-${node.id}`}
              cx={cx}
              cy={cy}
              rx={rx}
              ry={ry}
              fill="none"
              stroke={isHighlighted ? node.color : "rgba(148,163,184,0.15)"}
              strokeWidth={isHighlighted ? 1.8 : 0.8}
              strokeDasharray={isHighlighted ? "none" : "4,8"}
              className="transition-all duration-300"
            />
          );
        })}
      </svg>

      {/* ================= CENTRAL SUN: WORK ENTITY ================= */}
      <motion.div
        className="absolute flex flex-col items-center justify-center rounded-full cursor-pointer"
        style={{
          width: 95 * zoom,
          height: 95 * zoom,
          left: cx - 47.5 * zoom,
          top: cy - 47.5 * zoom,
          background: `radial-gradient(circle at 35% 35%, #fde047, #f59e0b, #d97706, #78350f)`,
          boxShadow: `0 0 ${45 * zoom}px rgba(245,158,11,0.6), 0 0 ${90 * zoom}px rgba(245,158,11,0.25), inset 0 0 ${20 * zoom}px rgba(255,255,255,0.3)`,
          zIndex: 15,
        }}
        animate={{
          boxShadow: [
            `0 0 ${45 * zoom}px rgba(245,158,11,0.5), 0 0 ${90 * zoom}px rgba(245,158,11,0.2)`,
            `0 0 ${60 * zoom}px rgba(245,158,11,0.7), 0 0 ${120 * zoom}px rgba(245,158,11,0.35)`,
            `0 0 ${45 * zoom}px rgba(245,158,11,0.5), 0 0 ${90 * zoom}px rgba(245,158,11,0.2)`,
          ],
        }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        onClick={() => setSelectedNode(selectedNode === "sun" ? null : "sun")}
      >
        <BookOpen className="text-white drop-shadow" style={{ width: 22 * zoom, height: 22 * zoom }} />
        <span className="text-white font-black text-center tracking-wide" style={{ fontSize: 10 * zoom }}>
          bf:Work
        </span>
        <span className="text-amber-100 text-center font-bold font-serif leading-tight px-1 truncate" style={{ fontSize: 9 * zoom, maxWidth: 85 * zoom }} dir="rtl">
          {workMainTitle}
        </span>
      </motion.div>

      {/* Sun Corona */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 150 * zoom,
          height: 150 * zoom,
          left: cx - 75 * zoom,
          top: cy - 75 * zoom,
          background: "radial-gradient(circle, rgba(245,158,11,0.12) 0%, transparent 70%)",
          zIndex: 10,
        }}
      />

      {/* ================= ORBITING PLANETS & MOONS ================= */}
      {orbitNodes.map(node => {
        const pos = getNodePosition(node);
        const isHovered = hoveredNode === node.id;
        const isSelected = selectedNode === node.id;
        const isActive = isHovered || isSelected;
        const sz = node.size * zoom;

        // Depth perspective
        const normAngle = ((node.startAngle + (elapsedTime / node.orbitSpeed) * 360) % 360) * (Math.PI / 180);
        const depthFactor = 0.75 + 0.25 * ((Math.sin(normAngle) + 1) / 2);
        const zIndex = Math.sin(normAngle) > 0 ? 25 : 8;

        return (
          <div key={node.id} className="contents">
            {/* Planet Glow */}
            <div
              className="absolute rounded-full pointer-events-none"
              style={{
                width: sz * 2.2,
                height: sz * 2.2,
                left: pos.x - sz * 1.1,
                top: pos.y - sz * 1.1,
                background: `radial-gradient(circle, ${node.glowColor} 0%, transparent 70%)`,
                opacity: isActive ? 0.9 : 0.35,
                transition: "opacity 0.25s",
                zIndex: zIndex - 1,
              }}
            />

            {/* Planet Node Body */}
            <motion.div
              className="absolute flex flex-col items-center justify-center rounded-full cursor-pointer select-none"
              style={{
                width: sz * depthFactor,
                height: sz * depthFactor,
                left: pos.x - (sz * depthFactor) / 2,
                top: pos.y - (sz * depthFactor) / 2,
                background: `radial-gradient(circle at 35% 35%, ${node.color}, ${node.color}cc, #090d16)`,
                boxShadow: isActive
                  ? `0 0 ${25 * zoom}px ${node.glowColor}, 0 0 ${50 * zoom}px ${node.glowColor}`
                  : `0 0 ${10 * zoom}px ${node.glowColor}`,
                border: `1.5px solid rgba(255,255,255,${isActive ? 0.8 : 0.25})`,
                zIndex,
                transition: "box-shadow 0.25s, border 0.25s",
              }}
              whileHover={{ scale: 1.25 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedNode(isSelected ? null : node.id)}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
            >
              <div className="text-white" style={{ transform: `scale(${depthFactor * 0.9})` }}>
                {node.icon}
              </div>
            </motion.div>

            {/* Planet Label */}
            <div
              className="absolute text-center pointer-events-none"
              style={{
                left: pos.x - 60,
                top: pos.y + (sz * depthFactor) / 2 + 4,
                width: 120,
                zIndex: zIndex + 2,
                opacity: isActive ? 1 : 0.7 * depthFactor,
                transition: "opacity 0.25s",
              }}
            >
              <div
                className="text-white font-bold leading-tight drop-shadow"
                style={{ fontSize: 9.5 * zoom, textShadow: `0 0 6px ${node.color}` }}
              >
                {node.label}
              </div>
              <div className="text-slate-400 font-mono leading-tight mt-0.5" style={{ fontSize: 8 * zoom }}>
                {node.sublabel}
              </div>
            </div>

            {/* Orbiting Moons (Satellites) */}
            {node.children && node.children.map((child, chIdx) => {
              const moonOrbit = (24 + chIdx * 10) * zoom;
              const moonSpeed = 10 + chIdx * 6;
              const moonAngle = ((elapsedTime / moonSpeed) * 360 + chIdx * 120) * (Math.PI / 180);
              const mx = pos.x + moonOrbit * Math.cos(moonAngle);
              const my = pos.y + moonOrbit * 0.65 * Math.sin(moonAngle);

              return (
                <div key={child.id} className="contents">
                  {/* Moon orbit path */}
                  <div
                    className="absolute rounded-full pointer-events-none"
                    style={{
                      width: moonOrbit * 2,
                      height: moonOrbit * 2 * 0.65,
                      left: pos.x - moonOrbit,
                      top: pos.y - moonOrbit * 0.65,
                      border: `0.5px dashed ${node.color}44`,
                      zIndex: zIndex + 1,
                    }}
                  />
                  {/* Moon body */}
                  <div
                    className="absolute flex items-center justify-center rounded-full pointer-events-none"
                    style={{
                      width: 14 * zoom,
                      height: 14 * zoom,
                      left: mx - 7 * zoom,
                      top: my - 7 * zoom,
                      background: child.color,
                      boxShadow: `0 0 6px ${child.color}`,
                      border: "1px solid rgba(255,255,255,0.4)",
                      zIndex: zIndex + 3,
                    }}
                  />
                  {/* Moon label on hover */}
                  {isActive && (
                    <div
                      className="absolute text-center pointer-events-none"
                      style={{
                        left: mx - 35,
                        top: my + 8 * zoom,
                        width: 70,
                        zIndex: zIndex + 4,
                      }}
                    >
                      <span className="text-slate-200 text-[8px] bg-slate-900/80 px-1 py-0.5 rounded border border-slate-700/60 font-semibold truncate block">
                        {child.label}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {/* ================= SELECTED NODE INSPECTOR PANEL ================= */}
      <AnimatePresence>
        {selectedData && (
          <motion.div
            className="absolute top-4 right-4 w-80 rounded-2xl overflow-hidden border shadow-2xl"
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{
              background: "rgba(15,23,42,0.92)",
              backdropFilter: "blur(20px)",
              borderColor: `${selectedData.color}55`,
              boxShadow: `0 0 35px ${selectedData.color}25`,
              zIndex: 100,
            }}
          >
            <div className="p-4 space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-md"
                    style={{ background: selectedData.color }}
                  >
                    {selectedData.icon}
                  </div>
                  <div>
                    <div className="text-white font-bold text-sm leading-tight">{selectedData.label}</div>
                    <span className="text-[10px] font-mono text-slate-400">{selectedData.rdfPredicate}</span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Full Value Box */}
              {selectedData.fullValue && (
                <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    <span>Predicate Value</span>
                    <button
                      onClick={() => handleCopy(selectedData.fullValue || "")}
                      className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    >
                      {copiedText ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedText ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                  <div className="text-xs text-slate-200 leading-relaxed font-sans select-all whitespace-pre-wrap" dir="rtl">
                    {selectedData.fullValue}
                  </div>
                </div>
              )}

              {/* External Authority Link */}
              {selectedData.authorityUri && (
                <div className="flex items-center justify-between p-2 rounded-lg bg-blue-950/40 border border-blue-800/40 text-xs">
                  <span className="text-blue-300 font-semibold">LOC Linked Authority</span>
                  <a
                    href={selectedData.authorityUri}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400 hover:text-white inline-flex items-center gap-1 font-mono text-[11px]"
                  >
                    Open <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}

              {/* Satellites List */}
              {selectedData.children && selectedData.children.length > 0 && (
                <div className="pt-2 border-t border-slate-800 space-y-1.5">
                  <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-amber-400" /> Orbiting Sub-Properties ({selectedData.children.length})
                  </div>
                  <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                    {selectedData.children.map(ch => (
                      <div
                        key={ch.id}
                        className="flex items-center justify-between p-1.5 rounded-lg bg-slate-800/50 text-xs text-slate-300"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: ch.color }} />
                          <span className="font-medium">{ch.label}</span>
                        </div>
                        {ch.uri && (
                          <a href={ch.uri} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-white">
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Orbital Physics Specs */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-[10px] text-slate-400 font-mono">
                <div>Orbit Radius: {selectedData.orbitRadius.toFixed(0)}px</div>
                <div>Revolution: {selectedData.orbitSpeed}s</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= SUN (WORK) INFO PANEL ================= */}
      <AnimatePresence>
        {selectedNode === "sun" && (
          <motion.div
            className="absolute top-4 right-4 w-80 rounded-2xl overflow-hidden border shadow-2xl"
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{
              background: "rgba(15,23,42,0.92)",
              backdropFilter: "blur(20px)",
              borderColor: "rgba(245,158,11,0.5)",
              boxShadow: "0 0 35px rgba(245,158,11,0.2)",
              zIndex: 100,
            }}
          >
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white bg-gradient-to-br from-amber-400 to-amber-600 shadow-md">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-white font-bold text-sm">bf:Work (Central Entity)</div>
                    <span className="text-[10px] font-mono text-amber-300/80">Conceptual Bibliographic Core</span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                <div className="text-[10px] font-semibold text-amber-400">Main Title</div>
                <div className="text-sm font-bold text-white font-serif" dir="rtl">{workMainTitle}</div>
              </div>

              <div className="space-y-1.5 text-xs text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Work URI:</span>
                  <span className="font-mono text-[11px] text-blue-400 truncate max-w-[180px]">{workUri}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Satellites:</span>
                  <span className="font-bold text-amber-300">{allOrbitNodes.length} planets & moons</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Manifestations:</span>
                  <span className="font-bold text-cyan-400">1 Instance (1650 Manuscript)</span>
                </div>
              </div>

              <button
                onClick={() => handleCopy(workUri)}
                className="w-full py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center gap-1.5 transition-colors shadow-md"
              >
                {copiedText ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedText ? "Copied Work URI" : "Copy Work URI"}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= CATEGORY FILTER TABS (TOP LEFT) ================= */}
      <div
        className="absolute top-4 left-4 flex items-center gap-1 p-1 rounded-xl"
        style={{
          background: "rgba(15,23,42,0.8)",
          backdropFilter: "blur(14px)",
          border: "1px solid rgba(148,163,184,0.12)",
          zIndex: 50,
        }}
      >
        {[
          { id: "all", label: "All / الكل", icon: <Orbit className="h-3 w-3" /> },
          { id: "core", label: "Core", icon: <BookOpen className="h-3 w-3" /> },
          { id: "intellectual", label: "Intellectual", icon: <User className="h-3 w-3" /> },
          { id: "manuscript", label: "Manuscript", icon: <FileText className="h-3 w-3" /> },
          { id: "holding", label: "Holdings", icon: <Building2 className="h-3 w-3" /> },
        ].map(cat => (
          <button
            key={cat.id}
            onClick={() => setFilterCategory(cat.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
              filterCategory === cat.id
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            {cat.icon}
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* ================= BOTTOM ORBIT CONTROLS ================= */}
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3.5 py-2 rounded-2xl shadow-xl"
        style={{
          background: "rgba(15,23,42,0.85)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(148,163,184,0.18)",
          zIndex: 50,
        }}
      >
        <button
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
          onClick={() => setIsPaused(!isPaused)}
          title={isPaused ? "Play Orbit" : "Pause Orbit"}
        >
          {isPaused ? <Play className="h-4 w-4 text-emerald-400" /> : <Pause className="h-4 w-4" />}
        </button>

        {/* Speed Toggles */}
        <div className="flex items-center gap-0.5 bg-slate-800/80 rounded-lg p-0.5 border border-slate-700/50">
          {[0.5, 1, 2].map(spd => (
            <button
              key={spd}
              onClick={() => setSpeedMultiplier(spd)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-colors ${
                speedMultiplier === spd ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-slate-700/60 mx-1" />

        <button
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
          onClick={() => setZoom(z => Math.min(1.8, z + 0.15))}
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
          onClick={() => setZoom(z => Math.max(0.5, z - 0.15))}
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
          onClick={() => { setZoom(1); setElapsedTime(0); setSelectedNode(null); setSpeedMultiplier(1); }}
          title="Reset View"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>

        <div className="w-px h-5 bg-slate-700/60 mx-1" />
        <span className="text-slate-400 text-[10px] font-mono px-1">
          {orbitNodes.length} nodes
        </span>
      </div>
    </div>
  );
}
