"use client";
import { useState } from "react";
import {
  ArrowRightLeft, Copy, Check} from "lucide-react";

interface MarvaRemergeMarcProps {
  workData: any;
  instanceData: any;
  itemData?: any;
  adminData?: any;
  hubData?: any;
  isDark?: boolean;
}

interface MarcFieldMapping {
  tag: string;
  ind1: string;
  ind2: string;
  subfields: string;
  origin: "Work" | "Instance" | "Item" | "Admin";
  uriGenerated: boolean;
  notes: string;
}

export function MarvaRemergeMarc({
  workData,
  instanceData,
  itemData,
  adminData,
  hubData,
  isDark = true
}: MarvaRemergeMarcProps) {
  const [copied, setCopied] = useState(false);
  const [filterOrigin, setFilterOrigin] = useState<"All" | "Work" | "Instance" | "Item" | "Admin">("All");

  // Generate mapping rows dynamically based on the current record data
  const mappings: MarcFieldMapping[] = [
    {
      tag: "001",
      ind1: " ",
      ind2: " ",
      subfields: instanceData?.lccn ? instanceData.lccn.replace(/\s+/g, '') : "2026348192",
      origin: "Admin",
      uriGenerated: false,
      notes: "Control number generated from AdminMetadata"
    },
    {
      tag: "008",
      ind1: " ",
      ind2: " ",
      subfields: "260917s2026    xx            000 0 eng d",
      origin: "Admin",
      uriGenerated: false,
      notes: "Fixed length data elements mapped from Admin & Provision"
    },
    {
      tag: "010",
      ind1: " ",
      ind2: " ",
      subfields: `$a ${instanceData?.lccn || "2026348192"}`,
      origin: "Instance",
      uriGenerated: false,
      notes: "LCCN mapped from Instance bf:identifiedBy/bf:Lccn"
    },
    {
      tag: "020",
      ind1: " ",
      ind2: " ",
      subfields: `$a ${instanceData?.isbn || "978-0-14-044913-6"}`,
      origin: "Instance",
      uriGenerated: false,
      notes: "ISBN mapped from Instance bf:identifiedBy/bf:Isbn"
    },
    {
      tag: "040",
      ind1: " ",
      ind2: " ",
      subfields: "$a DLC $b eng $e rda $c DLC",
      origin: "Admin",
      uriGenerated: false,
      notes: "Cataloging source mapped from bf:descriptionModifier"
    },
    {
      tag: "041",
      ind1: "0",
      ind2: " ",
      subfields: `$a ${workData?.language || "eng"}`,
      origin: "Work",
      uriGenerated: true,
      notes: "Language code mapped from Work bf:language"
    },
    {
      tag: "050",
      ind1: "0",
      ind2: "0",
      subfields: `$a ${instanceData?.shelfMark || "PJ7842.A85"} $b A6 2026`,
      origin: "Work",
      uriGenerated: false,
      notes: "LC Classification mapped from Work bf:classification"
    },
    {
      tag: "100",
      ind1: "1",
      ind2: " ",
      subfields: `$a ${workData?.creator || "Al-Jawahiri, Muhammad Mahdi,"} $e author $1 ${workData?.creatorUri || "http://id.loc.gov/rwo/agents/n80070338"}`,
      origin: "Work",
      uriGenerated: true,
      notes: "Creator mapped from Work bf:PrimaryContribution"
    },
    {
      tag: "240",
      ind1: "1",
      ind2: "0",
      subfields: `$a ${hubData?.title || workData?.uniformTitle || "Selected poems"} $1 ${hubData?.uri || "http://id.loc.gov/resources/hubs/4978c720"}`,
      origin: "Work",
      uriGenerated: true,
      notes: "Uniform Title / Hub mapped from Work bf:expressionOf"
    },
    {
      tag: "245",
      ind1: "1",
      ind2: "0",
      subfields: `$a ${workData?.mainTitle || "Diwan al-Jawahiri"} : $b ${workData?.subtitle || "al-majmu'ah al-kamilah"} / $c ${instanceData?.statementOfResponsibility || "Muhammad Mahdi al-Jawahiri."}`,
      origin: "Work",
      uriGenerated: false,
      notes: "Title from Work ($a,$b) and Statement of Responsibility from Instance ($c)"
    },
    {
      tag: "250",
      ind1: " ",
      ind2: " ",
      subfields: `$a ${instanceData?.edition || "First edition."}`,
      origin: "Instance",
      uriGenerated: false,
      notes: "Edition statement from Instance bf:editionStatement"
    },
    {
      tag: "264",
      ind1: " ",
      ind2: "1",
      subfields: `$a ${instanceData?.placeOfPublication || "Baghdad"} : $b ${instanceData?.publisher || "Dar al-Shu'un al-Thaqafiyah"} , $c ${instanceData?.publicationDate || "2026."}`,
      origin: "Instance",
      uriGenerated: true,
      notes: "Publication activity from Instance bf:Publication"
    },
    {
      tag: "300",
      ind1: " ",
      ind2: " ",
      subfields: `$a ${instanceData?.extent || "2 volumes (850 pages)"} ; $c ${instanceData?.dimensions || "24 cm"}`,
      origin: "Instance",
      uriGenerated: false,
      notes: "Physical description extent and dimensions from Instance"
    },
    {
      tag: "334",
      ind1: " ",
      ind2: " ",
      subfields: "$a single unit $2 rdai $0 http://id.loc.gov/vocabulary/issuance/mono",
      origin: "Instance",
      uriGenerated: true,
      notes: "Mode of issuance mapped from Instance bf:issuance"
    },
    {
      tag: "336",
      ind1: " ",
      ind2: " ",
      subfields: "$a text $b txt $2 rdacontent $0 http://id.loc.gov/vocabulary/contentTypes/txt",
      origin: "Work",
      uriGenerated: true,
      notes: "Content type mapped from Work bf:content"
    },
    {
      tag: "337",
      ind1: " ",
      ind2: " ",
      subfields: "$a unmediated $b n $2 rdamedia $0 http://id.loc.gov/vocabulary/mediaTypes/n",
      origin: "Instance",
      uriGenerated: true,
      notes: "Media type mapped from Instance bf:media"
    },
    {
      tag: "338",
      ind1: " ",
      ind2: " ",
      subfields: "$a volume $b nc $2 rdacarrier $0 http://id.loc.gov/vocabulary/carriers/nc",
      origin: "Instance",
      uriGenerated: true,
      notes: "Carrier type mapped from Instance bf:carrier"
    },
    {
      tag: "490",
      ind1: "0",
      ind2: " ",
      subfields: `$a ${workData?.seriesStatement || "Silsilat al-Ibadat ; 42"}`,
      origin: "Instance",
      uriGenerated: false,
      notes: "Transcribed Series statement from Instance bf:seriesStatement"
    },
    {
      tag: "500",
      ind1: " ",
      ind2: " ",
      subfields: "$a Poems in classical Arabic meter.",
      origin: "Work",
      uriGenerated: false,
      notes: "General work note mapped from Work bf:note"
    },
    {
      tag: "504",
      ind1: " ",
      ind2: " ",
      subfields: "$a Includes bibliographical references and index.",
      origin: "Work",
      uriGenerated: false,
      notes: "Supplementary content mapped from Work bf:supplementaryContent"
    },
    {
      tag: "520",
      ind1: " ",
      ind2: " ",
      subfields: `$a ${workData?.summary || "Comprehensive collection of poetry by prominent 20th-century Iraqi poet."}`,
      origin: "Work",
      uriGenerated: false,
      notes: "Summary note mapped from Work bf:summary"
    },
    {
      tag: "650",
      ind1: " ",
      ind2: "0",
      subfields: "$a Arabic poetry $y 20th century $0 http://id.loc.gov/authorities/subjects/sh85006378",
      origin: "Work",
      uriGenerated: true,
      notes: "Subject topic mapped from Work bf:subject/bf:Topic"
    },
    {
      tag: "651",
      ind1: " ",
      ind2: "0",
      subfields: "$a Iraq $x Intellectual life $y 20th century $0 http://id.loc.gov/authorities/subjects/sh85067982",
      origin: "Work",
      uriGenerated: true,
      notes: "Geographic subject mapped from Work bf:subject/bf:Place"
    },
    {
      tag: "655",
      ind1: " ",
      ind2: "7",
      subfields: "$a Poetry $2 lcgft $0 http://id.loc.gov/authorities/genreForms/gf2014026481",
      origin: "Work",
      uriGenerated: true,
      notes: "Genre/Form mapped from Work bf:genreForm"
    },
    {
      tag: "852",
      ind1: "0",
      ind2: " ",
      subfields: `$a DLC $b Main Stacks $h ${instanceData?.shelfMark || "PJ7842.A85"} $i A6 2026`,
      origin: "Item",
      uriGenerated: false,
      notes: "Item holding location and call number from bf:Item"
    }
  ];

  const filteredMappings = filterOrigin === "All"
    ? mappings
    : mappings.filter((m) => m.origin === filterOrigin);

  const fullMarcText = mappings
    .map((m) => `=${m.tag}  ${m.ind1}${m.ind2}${m.subfields}`)
    .join("\n");

  const handleCopy = () => {
    navigator.clipboard.writeText(fullMarcText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const getOriginBadge = (origin: string) => {
    switch (origin) {
      case "Work":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">Work (Blue)</span>;
      case "Instance":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">Instance (Peach)</span>;
      case "Item":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Item (Green)</span>;
      case "Admin":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">Admin (Yellow)</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-blue-900/30 via-orange-900/20 to-blue-900/30 border border-blue-500/20 flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
          <ArrowRightLeft className="w-6 h-6" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white">Remerge Modern MARC Record & Mappings</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
              Marva Appendix D & G
            </span>
          </div>
          <p className="text-xs text-gray-300 mt-1 leading-relaxed">
            In modern cataloging, MARC records are synthesized directly from the BIBFRAME graph. Fields are color-coded by the originating resource entity (<strong>Work = Blue</strong>, <strong>Instance = Peach/Salmon</strong>, <strong>Item = Green</strong>, <strong>Admin = Yellow</strong>). When modifying data, refer to these origins to decide whether edits belong in the Work or Instance.
          </p>
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-white/[0.02] border border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-400">Filter by Origin:</span>
          {(["All", "Work", "Instance", "Item", "Admin"] as const).map((o) => (
            <button
              key={o}
              onClick={() => setFilterOrigin(o)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                filterOrigin === o
                  ? "bg-white/20 text-white shadow"
                  : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200"
              }`}
            >
              {o}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied MARC!" : "Copy Full MARC"}
          </button>
        </div>
      </div>

      {/* Mappings Table */}
      <div className="rounded-3xl border border-white/10 overflow-hidden bg-black/40 shadow-xl">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.03] text-gray-400 font-bold uppercase tracking-wider text-[11px]">
              <th className="py-3 px-4 w-16">Tag</th>
              <th className="py-3 px-2 w-12 text-center">Ind</th>
              <th className="py-3 px-4">Field Content / Subfields</th>
              <th className="py-3 px-4 w-32">Origin Entity</th>
              <th className="py-3 px-4">Marva & Primer Mapping Logic</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredMappings.map((row, idx) => (
              <tr key={idx} className="hover:bg-white/[0.02] transition-colors font-mono">
                <td className="py-2.5 px-4 font-bold text-sky-400">{row.tag}</td>
                <td className="py-2.5 px-2 text-center text-gray-400">
                  {row.ind1 === " " ? "_" : row.ind1}{row.ind2 === " " ? "_" : row.ind2}
                </td>
                <td className="py-2.5 px-4 text-white font-medium select-all break-words max-w-md">
                  {row.subfields}
                </td>
                <td className="py-2.5 px-4 font-sans">
                  {getOriginBadge(row.origin)}
                </td>
                <td className="py-2.5 px-4 font-sans text-gray-400 text-[11px]">
                  {row.notes}
                  {row.uriGenerated && (
                    <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-mono bg-indigo-500/20 text-indigo-300">
                      URI $0/$1
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
